import React, { useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { AppState, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, PREFS, R, SH, SP, T, display, numeral } from './theme';
import { Icon } from './icons';
import { challengeFits, sortPosts, upcoming, useShabbat, useStore, type Challenge, type EventItem } from './store';
import { Band, BrushTag, Hairline, Label, Row, SectionHead, Slab, Stat, Ticks, eventPicture, hebrewDate, heroType, useAspect } from './look';
import { useChallengeCard } from './rewards';
import { InviteCards, useMyInvites } from './invites';
import { MINYAN_FALLBACK, minyanTime } from './minyan';
import { audienceLabel } from './ui';
import { clockOf, clockText, prettyTime, dateRange, dayAndTime, isOver, parseDay, spotlight, startsAt, whenWords } from './when';
import { nyDate, nyTime } from './zmanim';

// ───────────────────────── Home ─────────────────────────
// The first screen is a full-screen carousel: one event per page, a flyer each, swiped sideways.
//   Page 1  the event closest to now (the spotlight of ./when: happening now, today, tomorrow;
//           otherwise simply the soonest one coming).
//   Pages 2-3  the next events: those the rabbi marked Featured (`priority`) first, then the soonest.
// Under the carousel the page carries on downward: your scoreboard, the newest posts, the menu,
// and this Shabbat. A waiting invitation is a band above the carousel and nothing otherwise.
const PAGES = 3;
const DATE_ROW = 22; // the date line and the page marker above the carousel
const HINT_ROW = 30; // "more below" under it

export function Home() {
  const { content, fits, gender, liveAlert } = useStore();
  const now = useNow();
  const win = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const events = upcoming(content.events).filter(fits);
  const spot = spotlight(events, now);
  // The clock ticks once a minute, but the carousel only changes when the day or its events do.
  const listKey = `${nyDate(new Date(now))}|${spot?.event.id ?? ''}|${events.map((e) => e.id + e.start + (e.priority ? '*' : '')).join(',')}`;
  const pages = useMemo(() => carouselEvents(events, now, spot?.event.id), [listKey, content.events]);
  const live = content.challenges.filter((c) => c.active && challengeFits(c, gender));
  const main = live.find((c) => c.id === 'tefillin') ?? live[0];
  const others = live.filter((c) => c !== main);
  const invites = useMyInvites();
  // How tall the first screen is: from under the header bar to above the tab bar (an invitation
  // band above it takes its own height out of that).
  const [bandH, setBandH] = useState(0);
  // a banner above the page (a live alert, Shabbat) pushes it down: measure where it really starts
  const [startY, setStartY] = useState(0);
  const wrap = useRef<View>(null);
  const column = Math.min(win.width, 560);
  const measure = () => wrap.current?.measureInWindow((_x, y) => { const at = Math.round(y - bandH); if (Number.isFinite(at) && Math.abs(at - startY) > 3) setStartY(at); });
  useEffect(() => { const t = setTimeout(measure, 150); return () => clearTimeout(t); }, [liveAlert, now, bandH, win.height]);
  const top = Math.max(insets.top + 58 + 16, startY);
  const visible = Math.max(430, win.height - top - insets.bottom - 64 - (invites.length ? bandH : 0));
  const pageH = visible - DATE_ROW - HINT_ROW;
  // which page the carousel is on (the marker beside the date changes it too)
  const scroller = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const count = Math.max(1, pages.length);
  useEffect(() => { if (index > count - 1) { setIndex(0); scroller.current?.scrollTo({ x: 0, animated: false }); } }, [count]);
  // a new first page (the data arrived, or the day turned) starts the carousel afresh, at its first page
  useEffect(() => { setIndex(0); }, [pages[0]?.id]);
  const goTo = (i: number) => { setIndex(i); scroller.current?.scrollTo({ x: i * column, animated: !PREFS.reduceMotion }); };

  return (
    <>
      <View onLayout={(e) => {
        const h = Math.ceil(e.nativeEvent.layout.height); if (h !== bandH) setBandH(h);
              }}>
        <InviteCards style={st.invites} />
      </View>
      <View ref={wrap} style={st.dateRow}>
        <DateLine now={now} />
        {count > 1 ? <Marker index={index} count={count} onNext={() => goTo((index + 1) % count)} /> : null}
      </View>
      <Carousel pages={pages} spotTag={spot?.tag} spotId={spot?.event.id} now={now} width={column} height={pageH} scroller={scroller} index={index} onIndex={setIndex} />
      <MoreBelow />
      {main ? (
        <>
          <Scoreboard ch={main} style={{ marginTop: 6 }} />
          {others.map((c, i) => <ChallengeRow key={c.id} ch={c} last={i === others.length - 1} />)}
        </>
      ) : null}
      <OnTheMenu />
      <FromRabbi afterBand={!!main} />
      <ShabbatBand />
    </>
  );
}

// The page looks at the clock once a minute, on the minute, and whenever the app comes back to
// the front: an event can start, end, or become "tomorrow" while the page is open.
function useNow(everyMs = 60000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const wait = () => { timer = setTimeout(() => { setNow(Date.now()); wait(); }, everyMs - (Date.now() % everyMs) + 60); };
    wait();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') setNow(Date.now()); });
    return () => { clearTimeout(timer); sub.remove(); };
  }, [everyMs]);
  return now;
}

// Which events are the pages, in order. Page 1 is the spotlight event, or the soonest one coming.
// Pages 2 and 3 are the next events: Featured first, then by date. Up to 3, each event once. A one-day
// event that is already over is left out; a weekly one that is over for today shows its next date.
export function carouselEvents(events: EventItem[], now: number, spotId?: string): EventItem[] {
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const all: EventItem[] = [];
  for (const e of events) {
    if (!isOver(e, now)) { all.push(e); continue; }
    if (e.repeat !== 'weekly') continue;
    const d = parseDay(e.start);
    const next = iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7));
    if (!e.repeatUntil || !/^\d{4}-\d{2}-\d{2}$/.test(e.repeatUntil) || next <= e.repeatUntil) all.push({ ...e, start: next, end: next });
  }
  const byDate = (a: EventItem, b: EventItem) => a.start.localeCompare(b.start) || (startsAt(a) ?? Infinity) - (startsAt(b) ?? Infinity);
  all.sort(byDate);
  const first = all.find((e) => e.id === spotId) ?? all[0];
  if (!first) return [];
  const rest = all.filter((e) => e.id !== first.id).sort((a, b) => Number(!!b.priority) - Number(!!a.priority) || byDate(a, b));
  return [first, ...rest].slice(0, PAGES);
}

// "WED, NOV 25" and the Hebrew date.
function DateLine({ now }: { now: number }) {
  const d = new Date(now);
  const today = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York' });
  const hebrew = hebrewDate(d);
  return (
    <View style={st.dateLine} accessible accessibilityLabel={hebrew ? `${today}, ${hebrew}` : today}>
      <Label tone="blue" size={13}>{today}</Label>
      {hebrew ? <Label tone="mute" size={13}>{hebrew}</Label> : null}
    </View>
  );
}

// ───────────────────────── the carousel ─────────────────────────

function Carousel({ pages, spotTag, spotId, now, width, height, scroller, index, onIndex }: {
  pages: EventItem[]; spotTag?: string; spotId?: string; now: number; width: number; height: number;
  scroller: React.RefObject<ScrollView | null>; index: number; onIndex: (i: number) => void;
}) {
  const count = Math.max(1, pages.length);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.max(0, Math.min(count - 1, Math.round(e.nativeEvent.contentOffset.x / width)));
    if (i !== index) onIndex(i);
  };
  return (
    <View style={[st.carousel, { height }]}>
      <ScrollView key={pages[0]?.id ?? "none"} ref={scroller} horizontal pagingEnabled showsHorizontalScrollIndicator={false} decelerationRate="fast" scrollEventThrottle={16} onScroll={onScroll}
        style={st.pagerScroll} contentContainerStyle={{ width: width * count }} scrollEnabled={count > 1}>
        {pages.length ? pages.map((e, i) => (
          <EventPage key={e.id} e={e} tag={i === 0 && e.id === spotId && spotTag ? spotTag : whenWords(e, now)} now={now} width={width} height={height} />
        )) : <EmptyPage width={width} height={height} />}
      </ScrollView>
    </View>
  );
}

// The page marker: slanted bars (the current one wide and cyan) and "1/3". Tapping it goes to the next page.
function Marker({ index, count, onNext }: { index: number; count: number; onNext: () => void }) {
  return (
    <Pressable onPress={onNext} hitSlop={{ top: 14, bottom: 14, left: 14, right: 4 }} style={({ pressed }) => [st.marker, pressed && st.dim]}
      accessibilityRole="button" accessibilityLabel={`Event ${index + 1} of ${count}. Next event`}>
      <View style={st.bars}>
        {Array.from({ length: count }, (_, i) => <View key={i} style={[st.bar, i === index && st.barOn]} />)}
      </View>
      <Text style={st.markNum}>{index + 1}/{count}</Text>
    </Pressable>
  );
}

// One event, one calm flyer: the tag, the picture large and whole, the title, one short line, one button.
function EventPage({ e, tag, now, width, height }: { e: EventItem; tag: string; now: number; width: number; height: number }) {
  const { openEvent, goingCount } = useStore();
  const picture = eventPicture(e);
  const ratio = useAspect(picture?.source, 0.77);
  const col = width - SP.gutter * 2;
  const [zone, setZone] = useState({ w: 0, h: 0 });
  const onZone = (ev: LayoutChangeEvent) => {
    const { width: w, height: h } = ev.nativeEvent.layout;
    if (Math.abs(w - zone.w) > 0.5 || Math.abs(h - zone.h) > 0.5) setZone({ w, h });
  };
  // the picture is always shown whole at its own shape, as large as the room allows, centered
  let box: { w: number; h: number } | null = null;
  if (zone.w > 0) {
    const r = picture ? ratio : 0.77;
    const w = Math.max(60, Math.min(zone.w - 24, (zone.h - 20) * r, picture ? 9999 : 230));
    box = { w: Math.round(w), h: Math.round(w / r) };
  }
  const open = () => openEvent(e.id);
  const typed = (e.time || '').trim();
  const clock = clockOf(typed);
  const extraTime = typed && (!clock || prettyTime(typed) !== clockText(clock)) ? typed : ''; // the tag already says a plain start time
  const line = [e.place, e.price].filter(Boolean).join(' · ');
  const count = e.showGoing ? goingCount[e.id] ?? 0 : 0;
  const small = [extraTime, audienceLabel(e), count > 0 ? `${count} going` : ''].filter(Boolean).join(' · ');
  const manyDays = !!e.end && e.end !== e.start;
  const lineText = line || (manyDays ? dateRange(e) : '');
  const titleStyle = e.title.length > 34 ? { ...T.hero, fontSize: 30, lineHeight: 30, paddingRight: 4 } : { ...T.hero, fontSize: 34, lineHeight: 34, paddingRight: 4 };
  return (
    <View style={[st.page, { width, height }]}>
      <BrushTag label={tag} style={st.tag} />
      <View style={st.zone} onLayout={onZone}>
        {box ? (
          picture ? (
            <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`${e.title} poster. Opens the event`}
              style={({ pressed }) => [st.print, SH.print, { width: box!.w, height: box!.h }, pressed && st.dim]}>
              <View style={st.printClip}><Image source={picture.source} style={st.printImg} resizeMode="cover" /></View>
              <View pointerEvents="none" style={st.printEdge} />
            </Pressable>
          ) : (
            <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`${e.title}, ${dayAndTime(e, now).day.toLowerCase()}. Opens the event`}
              style={({ pressed }) => [st.print, st.typePrint, SH.print, { width: box!.w, height: box!.h }, pressed && st.dim]}>
              <DateBig date={e.start} size={Math.round(box.w * 0.68)} />
              <View style={st.typeBar} />
              <View pointerEvents="none" style={st.printEdge} />
            </Pressable>
          )
        ) : null}
      </View>
      <Pressable onPress={open} accessible={false} style={({ pressed }) => pressed && st.dim}>
        <Text style={[titleStyle, st.title]} numberOfLines={2} accessibilityRole="button" accessibilityLabel={`${e.title}. ${tag.toLowerCase()}.`} accessibilityHint="Opens the event">{e.title}</Text>
        {lineText ? <Text style={st.line} numberOfLines={1}>{lineText}</Text> : null}
        {small ? <Label size={11} tone="blue" numberOfLines={1} style={st.small}>{small}</Label> : null}
      </Pressable>
      <Action e={e} />
    </View>
  );
}

// No picture: the date stands where a poster would.
function DateBig({ date, size }: { date: string; size: number }) {
  const d = parseDay(date);
  const weekday = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()];
  const month = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][d.getMonth()];
  return (
    <View accessible={false}>
      <Label tone="blue" size={13}>{weekday}</Label>
      <Text style={[st.dateNum, { fontSize: size, lineHeight: Math.round(size * 0.94) }]} numberOfLines={1}>{d.getDate()}</Text>
      <Label size={13}>{month}</Label>
    </View>
  );
}

// The one button, wired to the same sign-up the event page uses. Cancelling happens on the event page.
function Action({ e }: { e: EventItem }) {
  const { going, name, signup, openEvent, invites: answers, respondInvite } = useStore();
  const invite = useMyInvites(true).find((v) => v.eventId === e.id);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setErr(null); }, [e.id]);
  if (e.signup !== 'app') return <Slab label="Details" onPress={() => openEvent(e.id)} style={st.btn} accessibilityLabel={`Details: ${e.title}`} />;
  const run = async () => {
    setBusy(true); setErr(null);
    const failed = await signup(e.id, true);
    // I'M IN is also the answer to an invitation to this event that is still waiting
    if (!failed && invite && !(answers || {})[invite.id]) await respondInvite(invite.id, 'yes');
    setErr(failed);
    setBusy(false);
  };
  return (
    <View style={st.btn}>
      {going.includes(e.id) ? (
        <Slab kind="outline" icon="tick" label="You're in" onPress={() => openEvent(e.id)} accessibilityLabel={`You're in: signed up for ${e.title}. Opens the event`} />
      ) : (
        // no name on the profile yet: the event page asks for it first
        <Slab label="I'm in" disabled={busy} onPress={() => (name ? run() : openEvent(e.id))} accessibilityLabel={`I'm in: sign up for ${e.title}`} />
      )}
      {err ? <Text style={st.err} accessibilityLiveRegion="polite">{err}</Text> : null}
    </View>
  );
}

// Nothing on the calendar: one clean flyer page that points at the Events tab.
function EmptyPage({ width, height }: { width: number; height: number }) {
  const { go } = useStore();
  return (
    <View style={[st.page, st.emptyPage, { width, height }]}>
      <Text style={[heroType('Nothing on the calendar yet', width - SP.gutter * 2), st.title]} accessibilityRole="header">Nothing on the calendar yet</Text>
      <Text style={st.emptyText}>New events are on the way. When the rabbi adds one it hangs here, and every event lives in the Events tab.</Text>
      <Slab kind="ghost" label="See all events" onPress={() => go('Events')} style={st.emptyBtn} />
    </View>
  );
}

// A quiet nudge that the page goes on.
function MoreBelow() {
  return (
    <View style={st.more} accessible accessibilityLabel="More below">
      <View style={st.moreIcon}><Icon name="right" size={16} color={C.faint} stroke={2.2} /></View>
    </View>
  );
}

// ───────────────────────── the scoreboard ─────────────────────────

const pad2 = (n: number) => String(n).padStart(2, '0');
// Shabbat ends at nightfall, not at sunset. 50 minutes after sunset is at or a little past the
// time the Shabbat band prints all year, so the scoreboard never says "over" early.
const SHABBAT_ENDS_MS = 50 * 60000;

// The main live challenge as a scoreboard band: which day you are on, out of how many, what is
// left of today, and the one thing to press. All of its facts come from useChallengeCard
// (rewards.tsx); SNAP starts the challenge page's own photo check-in.
function Scoreboard({ ch, style }: { ch: Challenge; style?: StyleProp<ViewStyle> }) {
  const card = useChallengeCard(ch);
  const { mine, done, count, wrap } = card;
  const daily = ch.every === 'day';
  const short = ch.title.replace(/^\s*\d+[\s-]*(?:day|week)s?\s+/i, '').trim() || ch.title; // "30 Day Tefillin Challenge" -> "Tefillin Challenge"
  const complete = count >= ch.goal;
  const state = wrap ? wrap.win.state : 'open';
  // today's bar is outlined while today can still be done (or has not opened yet)
  const pending = mine && !done && !complete && (state === 'open' || state === 'before');
  const number = !mine ? ch.goal : Math.min(ch.goal, pending ? count + 1 : count);
  return (
    <Band group onPress={card.open} style={style}>
      <View style={st.scoreTop}>
        <View style={st.scoreLeft} accessible accessibilityRole="button" accessibilityLabel={`${ch.title}. ${card.line}`}>
          <Label numberOfLines={1} style={st.scoreLabel}>{mine ? `${short} · ${daily ? 'Day' : 'Week'}` : short}</Label>
          <View style={st.scoreBig}>
            <Text style={st.scoreNum}>{number}</Text>
            <Text style={st.scoreOf}>{mine ? `/${ch.goal}` : daily ? 'days' : 'weeks'}</Text>
          </View>
        </View>
        <View style={st.scoreRight}>
          <ScoreSide ch={ch} card={card} complete={complete} />
        </View>
      </View>
      <Ticks total={ch.goal} done={mine ? count : 0} pending={pending} style={st.ticks} />
    </Band>
  );
}

// The right half of the scoreboard: what today asks of you.
function ScoreSide({ ch, card, complete }: { ch: Challenge; card: ReturnType<typeof useChallengeCard>; complete: boolean }) {
  const { mine, done, wrap, fire } = card;
  const daily = ch.every === 'day';
  const friday = !!wrap?.win.friday;
  if (!mine) {
    // "Luxury EZRI backpack (valued at $300)": the prize on one line, what is in brackets under it
    const [, prize = card.prize, detail = ''] = /^(.+?)\s*(\([^()]*\))\s*$/.exec(card.prize) ?? [];
    return (
      <>
        {prize ? (
          <>
            {wrap?.lastHour ? <Label tone="orange" style={st.joinLeft}>{Math.max(1, Math.ceil(wrap.left / 60000))} min left today</Label> : null}
            <Label tone={wrap?.lastHour ? 'sub' : 'orange'}>Win</Label>
            <Text style={st.prize} numberOfLines={2}>{prize}</Text>
            {detail ? <Text style={st.prizeDetail} numberOfLines={1}>{detail}</Text> : null}
          </>
        ) : null}
        <Slab size="md" label="Join" onPress={card.open} style={st.scoreBtn} accessibilityLabel={`Join: ${ch.title}`} />
      </>
    );
  }
  if (done || complete) {
    return (
      <>
        <View style={st.doneRow}>
          <Icon name="tick" size={24} color={C.blue} stroke={3.6} />
          <Text style={st.doneText}>Done</Text>
        </View>
        <Label style={st.sideLabel}>{complete ? `All ${ch.goal} ${daily ? 'days' : 'weeks'}` : !daily ? 'See you next week' : friday ? 'See you Sunday' : 'See you tomorrow'}</Label>
        <Slab size="md" kind="ghost" label={ch.photo ? 'Wall' : 'Open'} onPress={card.open} style={st.scoreBtn} accessibilityLabel={`${ch.photo ? "Today's wall" : 'Open'}: ${ch.title}`} />
      </>
    );
  }
  const state = wrap ? wrap.win.state : 'open';
  if (state === 'open') {
    return (
      <>
        {wrap ? <WrapClock until={wrap.win.set} /> : fire > 0 ? <Text style={st.clock}>{fire}</Text> : null}
        <Label style={st.sideLabel}>{wrap ? (friday ? 'Left before Shabbat' : 'Left to wrap today') : fire > 0 ? `${daily ? (fire === 1 ? 'Day' : 'Days') : fire === 1 ? 'Week' : 'Weeks'} in a row` : 'Start your streak'}</Label>
        <Slab size="md" kind="orange" label={ch.photo ? 'Snap' : 'Check in'} onPress={card.snap} style={st.scoreBtn} accessibilityLabel={ch.photo ? "Snap today's selfie" : 'Check in for today'} />
      </>
    );
  }
  // the window is closed: before sunrise, after sunset, or Shabbat
  return (
    <>
      {state === 'before' ? <Label tone="ink">Opens at {nyTime(wrap!.win.rise)}</Label>
        : state === 'shabbat' ? (
          // Saturday night: once Shabbat has ended the band stops saying it is Shabbat
          wrap!.now > wrap!.win.set + SHABBAT_ENDS_MS ? (
            <>
              <Label tone="ink">Shabbat is over</Label>
              <Label style={st.sideLabel}>Back tomorrow</Label>
            </>
          ) : <Label tone="ink">Shabbat · no wrap today</Label>
        )
          : (
            <>
              <Label tone="ink">{friday ? 'Candle lighting passed' : 'Sunset passed'}</Label>
              <Label style={st.sideLabel}>{friday ? 'Back Sunday' : 'Back tomorrow'}</Label>
            </>
          )}
      <Slab size="md" kind="ghost" label="Wall" onPress={card.open} style={st.scoreBtn} accessibilityLabel={`Today's wall: ${ch.title}`} />
    </>
  );
}

// Hours, minutes and seconds until the window closes. The ticking stays in here: once a second
// this one line redraws and nothing else on the page does.
function WrapClock({ until }: { until: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((until - now) / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return <Text style={st.clock} numberOfLines={1} accessibilityLabel={`${h} hours ${m} minutes left`}>{h}:{pad2(m)}:{pad2(s % 60)}</Text>;
}

// Any other live challenge: one row under the scoreboard.
function ChallengeRow({ ch, last }: { ch: Challenge; last?: boolean }) {
  const card = useChallengeCard(ch);
  return (
    <Row title={ch.title} meta={card.line} onPress={card.open} last={last} accessibilityLabel={`${ch.title}. ${card.line}`}
      right={<Slab size="chip" kind={!card.mine ? 'cyan' : card.done ? 'outline' : 'orange'} icon={card.done ? 'tick' : undefined} label={card.action} />} />
  );
}

// ───────────────────────── the rest of the page ─────────────────────────

// The food post, while it is fresh (4 days).
const OnTheMenu = React.memo(function OnTheMenu() {
  const { content } = useStore();
  const food = [...content.posts].filter((p) => p.kind === 'Food' && Date.now() - new Date(p.at).getTime() < 4 * 864e5).sort((a, b) => b.at.localeCompare(a.at))[0];
  if (!food) return null;
  const photo = food.photos?.[0];
  return (
    <View style={st.menu}>
      <Hairline />
      <Row kicker="On the menu" title={food.title} meta={food.body || undefined} metaLines={1} thumb={photo} chevron={!photo}
        onPress={() => router.push(`/post/${food.id}`)} accessibilityLabel={`On the menu: ${food.title}`} />
    </View>
  );
});

// The three newest posts (pinned first), as rows.
const FromRabbi = React.memo(function FromRabbi({ afterBand }: { afterBand?: boolean }) {
  const { content, go } = useStore();
  const posts = sortPosts(content.posts).filter((p) => p.kind !== 'Food').slice(0, 3);
  if (!posts.length) return null;
  return (
    <>
      <SectionHead title="From Rabbi Zevy" action="See all" onAction={() => go('Feed')} top={afterBand ? 20 : SP.section} />
      {posts.map((p, i) => {
        return (
          <Row key={p.id} title={p.title} meta={p.body || undefined} metaLines={1} thumb={p.photos?.[0]} last={i === posts.length - 1}
            onPress={() => router.push(`/post/${p.id}`)} accessibilityLabel={p.title} />
        );
      })}
    </>
  );
});

// This Shabbat in Great Neck: candle lighting and when it ends, side by side, then the Teen Minyan.
const ShabbatBand = React.memo(function ShabbatBand() {
  const sh = useShabbat();
  const { content } = useStore();
  if (sh === 'error') return null;
  const teen = (content.minyan?.shabbat ?? MINYAN_FALLBACK.shabbat).find((r) => /teen/i.test(r.label));
  return (
    <Band style={st.shabbat}>
      <Label>Shabbat in Great Neck{sh?.parsha ? ` · ${sh.parsha}` : ''}</Label>
      {sh ? (
        <View style={st.shabTimes}>
          <Stat value={sh.candles ?? '—'} label="Candle lighting" size={40} style={st.shabTime} />
          <Hairline strong vertical />
          <Stat value={sh.havdalah ?? '—'} label="Shabbat ends" size={40} style={[st.shabTime, st.shabSecond]} />
        </View>
      ) : <Text style={[T.small, { marginTop: 6 }]}>Loading this week's times…</Text>}
      {teen ? (
        <View style={st.shabTeen}>
          <Label numberOfLines={1} style={st.shabTeenLabel}>{teen.label} · Saturday</Label>
          <Text style={st.shabTeenTime} numberOfLines={1}>{minyanTime(teen.time, sh || null).time}</Text>
        </View>
      ) : null}
    </Band>
  );
});


const st = StyleSheet.create({
  invites: { marginTop: 0, marginBottom: 14 },
  dateRow: { height: DATE_ROW, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateLine: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  carousel: { marginHorizontal: -SP.gutter },
  pagerScroll: { flex: 1 },
  marker: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  bars: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bar: { width: 10, height: 6, borderRadius: 1.5, backgroundColor: C.tick, transform: [{ skewX: '-16deg' }] },
  barOn: { width: 18, backgroundColor: C.sub },
  markNum: { fontFamily: F.bold, fontSize: 11, lineHeight: 14, letterSpacing: 1.8, color: C.faint, minWidth: 24 },
  // a flyer
  page: { paddingHorizontal: SP.gutter, paddingTop: 12 },
  tag: { marginTop: 2, marginLeft: 6, alignSelf: 'flex-start' },
  title: { marginTop: 4 },
  line: { fontSize: 15, lineHeight: 20, fontWeight: '500', color: C.sub, marginTop: 6 },
  small: { marginTop: 7 },
  btn: { marginTop: 18, marginBottom: 8 },
  zone: { flex: 1, marginTop: 14, marginBottom: 18, alignItems: 'center', justifyContent: 'center' },
  print: { borderRadius: R.print, backgroundColor: C.card, transform: [{ rotate: '-1.6deg' }] },
  printClip: { flex: 1, borderRadius: R.print, overflow: 'hidden' },
  printImg: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  printEdge: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: R.print, borderWidth: 1, borderColor: C.printEdge },
  typeBar: { width: 28, height: 5, borderRadius: 1.5, backgroundColor: C.blue, transform: [{ skewX: '-16deg' }] },
  typePrint: { backgroundColor: C.raised, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 14, justifyContent: 'space-between' },
  dateNum: { ...numeral(132), marginTop: 2, marginLeft: -3, paddingRight: 16 },
  err: { fontSize: 13, lineHeight: 17, fontWeight: '700', color: C.red, textAlign: 'center' },
  emptyPage: { justifyContent: 'center', paddingBottom: 40 },
  emptyText: { ...T.body, color: C.sub, marginTop: 14 },
  emptyBtn: { marginTop: 22, alignSelf: 'flex-start' },
  more: { height: HINT_ROW, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  moreIcon: { transform: [{ rotate: '90deg' }] },
  dim: { opacity: 0.5 },
  // the scoreboard
  scoreTop: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  scoreLeft: { flexShrink: 1, minWidth: 0 },
  scoreLabel: { lineHeight: 12, letterSpacing: 1.92 },
  // The number's own line is taller here than on the mockup (so its top is never clipped on the
  // phone); the two margins take that back, so the label above and the bars below sit where they do there.
  scoreBig: { flexDirection: 'row', alignItems: 'baseline', marginTop: 1.7, marginBottom: -2 },
  scoreNum: { fontFamily: F.num, fontSize: 54, lineHeight: 51, color: C.blue, paddingRight: 7 },
  scoreOf: { fontFamily: F.boldItalic, fontSize: 24, lineHeight: 26, color: C.faint, textTransform: 'uppercase', marginLeft: -2, paddingRight: 3 },
  scoreRight: { alignItems: 'flex-end', flexShrink: 0, maxWidth: '62%' },
  clock: { fontFamily: F.display, fontSize: 31, lineHeight: 31, letterSpacing: 0.3, color: C.orangeText, fontVariant: ['tabular-nums'], textAlign: 'right', paddingRight: 4, marginRight: -4 },
  sideLabel: { marginTop: 4, lineHeight: 12, letterSpacing: 1.92, textAlign: 'right' },
  scoreBtn: { marginTop: 7, alignSelf: 'flex-end' },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  doneText: { fontFamily: F.display, fontSize: 31, lineHeight: 31, letterSpacing: 0.6, color: C.blue, textTransform: 'uppercase', paddingRight: 4, marginRight: -4 },
  joinLeft: { marginBottom: 5, textAlign: 'right' },
  prize: { fontSize: 15, lineHeight: 19, fontWeight: '600', color: C.ink, textAlign: 'right', marginTop: 3 },
  prizeDetail: { fontSize: 13, lineHeight: 17, color: C.sub, textAlign: 'right' },
  ticks: { marginTop: 11 },
  // the rest
  menu: { marginTop: 22 },
  shabbat: { marginTop: SP.section },
  shabTimes: { flexDirection: 'row', alignItems: 'stretch', marginTop: 8 },
  shabTime: { flex: 1 },
  shabSecond: { paddingLeft: SP.gutter },
  shabTeen: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12, paddingTop: 11, borderTopWidth: 1, borderTopColor: C.line },
  shabTeenLabel: { flex: 1 },
  shabTeenTime: { ...display(20, C.blue) },
});
