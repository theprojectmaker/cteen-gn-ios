import React, { useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { AppState, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, PREFS, R, SP, T, display, numeral } from './theme';
import { Icon } from './icons';
import { challengeFits, goingKey, sortPosts, upcoming, useRsvp, useShabbat, useStore, type Challenge, type EventItem } from './store';
import { Band, BrushTag, CountChip, DayBlock, Hairline, Label, Row, Slab, Ticks, eventPicture, galleryCount, hebrewDate, heroType, useAspect, capsWidth } from './look';
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
const TAB_BAR = 56; // the floating tab bar, with its own margin
const HINT_ROW = 24; // "more below" under it

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
  // the carousel is exactly as wide as the page column (measured, never margin math)
  const [cw, setCw] = useState(column - SP.gutter * 2);
  const measure = () => wrap.current?.measureInWindow((_x, y) => { const at = Math.round(y - bandH); if (Number.isFinite(at) && Math.abs(at - startY) > 3) setStartY(at); });
  useEffect(() => { const t = setTimeout(measure, 150); return () => clearTimeout(t); }, [liveAlert, now, bandH, win.height]);
  const top = Math.max(insets.top + 58 + 16, startY);
  const visible = Math.max(430, win.height - top - insets.bottom - TAB_BAR - 40 - (invites.length ? bandH : 0));
  const pageH = visible - DATE_ROW - HINT_ROW;
  // which page the carousel is on (the marker beside the date changes it too)
  const scroller = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const count = Math.max(1, pages.length);
  useEffect(() => { if (index > count - 1) { setIndex(0); scroller.current?.scrollTo({ x: 0, animated: false }); } }, [count]);
  // a new first page (the data arrived, or the day turned) starts the carousel afresh, at its first page
  useEffect(() => { setIndex(0); }, [pages[0]?.id]);
  const goTo = (i: number) => { setIndex(i); scroller.current?.scrollTo({ x: i * cw, animated: !PREFS.reduceMotion }); };

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
      <View onLayout={(ev) => { const w = Math.round(ev.nativeEvent.layout.width); if (w > 0 && w !== cw) setCw(w); }}>
        <Carousel pages={pages} spotTag={spot?.tag} spotId={spot?.event.id} now={now} width={cw} height={pageH} scroller={scroller} index={index} onIndex={setIndex} />
      </View>
      <MoreBelow />
      {main ? (
        <>
          <Scoreboard ch={main} style={{ marginTop: 32 }} />
          {others.map((c, i) => <ChallengeRow key={c.id} ch={c} last={i === others.length - 1} />)}
        </>
      ) : null}
      <OnTheMenu />
      <WeeklyEvents />
      <FromRabbi />
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
    <View style={st.carousel}>
      <ScrollView key={pages[0]?.id ?? "none"} ref={scroller} horizontal pagingEnabled bounces={false} overScrollMode="never" showsHorizontalScrollIndicator={false} decelerationRate="fast" scrollEventThrottle={16} onScroll={onScroll}
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

// One event, one flyer: the tag, the picture as the hero, the title, one short line, one button. The poster is sized
// from the screen width first (at least 62% of it), the page grows taller than the screen if it has to.
function EventPage({ e, tag, now, width, height }: { e: EventItem; tag: string; now: number; width: number; height: number }) {
  const { openEvent, goingCount } = useStore();
  const win = useWindowDimensions();
  const picture = eventPicture(e);
  const col = width;
  const ratio = useAspect(picture?.source, 0.77);
  const open = () => openEvent(e.id);
  const typed = (e.time || '').trim();
  const clock = clockOf(typed);
  const extraTime = typed && (!clock || prettyTime(typed) !== clockText(clock)) ? typed : ''; // the tag already says a plain start time
  const line = [e.place, e.price].filter(Boolean).join(' · ');
  const count = e.showGoing ? goingCount[goingKey(e)] ?? 0 : 0;
  const manyDays = !!e.end && e.end !== e.start;
  // one info line: where, how much, who for, anything the tag could not say, and how many are going
  const lineText = [line || (manyDays ? dateRange(e) : ''), extraTime, audienceLabel(e), count > 0 ? `${count} going` : ''].filter(Boolean).join(' · ');
  // The title takes one line when it can (the biggest of 34 / 30 / 27 / 26 that fits the column), else two lines at 26.
  const fit = [34, 30, 27, 26].find((n) => capsWidth(e.title, n, 0.2) <= col - Math.ceil(n * 0.12) - 4);
  const titleSize = fit ?? 26;
  const titleStyle = { ...T.hero, fontSize: titleSize, lineHeight: Math.round(titleSize * 1.02), paddingRight: Math.ceil(titleSize * 0.12) };
  // What the page needs besides the picture: the tag, the title, the info lines and the button.
  const [rest, setRest] = useState(0); // measured: the page's height without the picture (tag, title, line, button, gaps)
  const chrome = rest || 48 + (fit ? 38 : 76) + 26 + 66 + 20;
  const availH = Math.max(0, height - chrome); // what is left for the picture on a screen this tall
  const isPoster = !!picture && picture.kind === 'poster';
  let panelW = col, panelH = 0, imgW = 0, imgH = 0;
  if (isPoster) {
    // from the width first: at least 62% of the screen, as tall as the screen allows beyond that, never wider than the column
    const byHeight = Math.floor((availH - 24) * ratio);
    imgW = Math.min(col - 24, Math.max(byHeight, Math.round(win.width * 0.62)));
    imgH = Math.round(imgW / ratio);
    panelW = imgW + 24; panelH = imgH + 24;
  } else if (picture) {
    panelH = Math.round(Math.min(Math.max(availH, 260), col * 1.3)); // a photograph fills the page: taller than 16:10 when the screen has the room (cover-cropped)
  } else {
    panelH = Math.round(Math.min(Math.max(availH, 260), col * 1.3));
  }
  return (
    <View style={[st.page, { width, minHeight: height }]}>
      <View onLayout={(ev) => { const r = Math.round(ev.nativeEvent.layout.height - (panelH + 20)); if (panelH > 0 && r > 0 && Math.abs(r - rest) > 1) setRest(r); }}>
      <BrushTag label={tag} style={st.tag} />
      <Pressable onPress={open} accessibilityRole="button"
        accessibilityLabel={picture ? `${e.title} poster. Opens the event` : `${e.title}, ${dayAndTime(e, now).day.toLowerCase()}. Opens the event`}
        style={({ pressed }) => [st.panel, !picture && st.panelType, { width: panelW, height: panelH }, isPoster && { alignSelf: 'center' }, pressed && st.dim]}>
        {picture ? (
          isPoster ? <Image source={picture.source} style={{ width: imgW, height: imgH }} resizeMode="contain" /> : <Image source={picture.source} style={st.fill} resizeMode="cover" />
        ) : (
          <View style={st.typeIn}>
            <DateBig date={e.start} size={Math.max(110, Math.min(200, Math.round(panelH * 0.5)))} />
            <View style={st.typeBar} />
          </View>
        )}
        <CountChip n={galleryCount(e)} />
        <View pointerEvents="none" style={st.panelEdge} />
      </Pressable>
      <Pressable onPress={open} accessible={false} style={({ pressed }) => pressed && st.dim}>
        <Text style={[titleStyle, st.title]} numberOfLines={fit ? 1 : 2} accessibilityRole="button" accessibilityLabel={`${e.title}. ${tag.toLowerCase()}.`} accessibilityHint="Opens the event">{e.title}</Text>
        {lineText ? <Text style={st.line} numberOfLines={1}>{lineText}</Text> : null}
      </Pressable>
      <Action e={e} />
      </View>
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
      <Text style={[st.dateNum, { fontSize: size, lineHeight: Math.round(size * 0.94), paddingRight: Math.round(size * 0.22) }]} numberOfLines={1} ellipsizeMode="clip">{d.getDate()}</Text>
      <Label size={13}>{month}</Label>
    </View>
  );
}

// The sign-up: I'M IN (or YOU'RE IN) with I'M OUT beside it, wired to the same sign-up the event page uses.
// I'M OUT really cancels (and puts it back if the call fails); after it the page says YOU'RE OUT and offers I'M IN again.
function Action({ e }: { e: EventItem }) {
  const { openEvent, invites: answers, respondInvite } = useStore();
  const invite = useMyInvites(true).find((v) => v.eventId === e.id);
  const r = useRsvp(e);
  if (e.signup !== 'app') return <Slab label="Details" onPress={() => openEvent(e.id)} style={st.btn} accessibilityLabel={`Details: ${e.title}`} />;
  const join = async () => {
    // I'M IN is also the answer to an invitation to this event that is still waiting
    if ((await r.imIn()) && invite && !(answers || {})[invite.id]) await respondInvite(invite.id, 'yes');
  };
  return (
    <View style={st.btn}>
      <View style={st.btnRow}>
        {r.mine ? (
          <Slab kind="outline" icon="tick" label="You're in" onPress={() => openEvent(e.id)} style={st.btnMain} accessibilityLabel={`You're in: signed up for ${e.title}. Opens the event`} />
        ) : r.isOut ? (
          <Slab kind="ghost" label="You're out" onPress={() => openEvent(e.id)} style={st.btnMain} accessibilityLabel={`You're out of ${e.title}. Opens the event`} />
        ) : (
          <Slab label="I'm in" disabled={r.busy} onPress={join} style={st.btnMain} accessibilityLabel={`I'm in: sign up for ${e.title}`} />
        )}
        {r.isOut ? (
          <Slab label="I'm in" disabled={r.busy} onPress={join} style={st.btnSide} accessibilityLabel={`I'm in after all: sign up for ${e.title}`} />
        ) : (
          <Slab kind="ghost" label="I'm out" disabled={r.busy} onPress={r.imOut} style={st.btnSide} accessibilityLabel={`I'm out: not coming to ${e.title}`} />
        )}
      </View>
      {r.err ? <Text style={st.err} accessibilityLiveRegion="polite">{r.err}</Text> : null}
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
// TEST ONLY: forces the "out" face of the scoreboard. Must stay false.
const FORCE_OUT = false;
const outCache: Record<string, boolean> = {};
// Has the server put this teen out of the challenge (3 missed days)? Asked once per day while
// the teen is in it (no polling); a failed answer counts as "not out".
function useIsOut(ch: Challenge, mine: boolean) {
  const { fetchWall } = useStore();
  const day = nyDate(new Date());
  const key = `${ch.id}|${day}`;
  const [out, setOut] = useState(() => !!outCache[key]);
  useEffect(() => {
    if (!mine || !ch.photo || key in outCache) return;
    let alive = true;
    fetchWall(ch.id, day).then((r) => {
      if ('error' in r) return;
      outCache[key] = !!r.me?.out;
      if (alive) setOut(outCache[key]);
    });
    return () => { alive = false; };
  }, [ch.id, mine, day]);
  return FORCE_OUT || (mine && out);
}

function Scoreboard({ ch, style }: { ch: Challenge; style?: StyleProp<ViewStyle> }) {
  const card = useChallengeCard(ch);
  const { mine, done, count, wrap } = card;
  const out = useIsOut(ch, mine);
  const daily = ch.every === 'day';
  const short = ch.title.replace(/^\s*\d+[\s-]*(?:day|week)s?\s+/i, '').trim() || ch.title; // "30 Day Tefillin Challenge" -> "Tefillin Challenge"
  const complete = count >= ch.goal;
  const state = wrap ? wrap.win.state : 'open';
  // today's bar is outlined while today can still be done (or has not opened yet)
  const pending = mine && !done && !complete && (state === 'open' || state === 'before');
  const number = !mine ? ch.goal : Math.min(ch.goal, pending ? count + 1 : count);
  if (out) {
    // put out of the challenge (only when the server says so): a big red X where the day count was,
    // no clock and no SNAP. It sits below the carousel, so it never shows above the tab bar at rest.
    return (
      <Band group onPress={card.open} style={style}>
        <View style={st.outRow} accessible accessibilityRole="button" accessibilityLabel={`${ch.title}. You're out. Back in for the next one.`}>
          <View style={st.outX}><Icon name="x" size={52} color={C.red} stroke={3.4} /></View>
          <View style={st.outText}>
            <Label numberOfLines={1} style={st.scoreLabel}>{short}</Label>
            <Text style={st.outWord}>Out</Text>
            <Text style={st.outLine}>Back in for the next one.</Text>
          </View>
        </View>
      </Band>
    );
  }
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
// Every section down here has the same two levels: one condensed heading, then rows with a
// condensed title and one readable line of system text, a hairline between rows, and plenty of air.

const GAP = 36; // between sections

// A section's one heading, with an optional link at its right.
function Head({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={st.head}>
      <Text style={st.headText} numberOfLines={1} accessibilityRole="header">{title}</Text>
      {action ? <Label tone="blue" size={13} onPress={onAction}>{action}</Label> : null}
    </View>
  );
}

// One row: an optional lead (a date, a picture), a title, one line under it, an optional chip.
function Line({ lead, title, line, lines = 1, thumb, right, onPress, last, label }: {
  lines?: number; lead?: React.ReactNode; title: string; line?: string; thumb?: string; right?: React.ReactNode; onPress: () => void; last?: boolean; label: string;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [st.row, !last && st.rowRule, last && st.rowLast, pressed && st.dim]}>
      {lead}
      <View style={st.lineText}>
        <Text style={st.lineTitle} numberOfLines={2}>{title}</Text>
        {line ? <Text style={st.lineSub} numberOfLines={lines}>{line}</Text> : null}
      </View>
      {thumb ? <Image source={{ uri: thumb }} style={st.thumb} accessibilityIgnoresInvertColors /> : null}
      {right}
    </Pressable>
  );
}

// The food post, while it is fresh (4 days).
const OnTheMenu = React.memo(function OnTheMenu() {
  const { content } = useStore();
  const food = [...content.posts].filter((p) => p.kind === 'Food' && Date.now() - new Date(p.at).getTime() < 4 * 864e5).sort((a, b) => b.at.localeCompare(a.at))[0];
  if (!food) return null;
  return (
    <View style={st.section}>
      <Head title="On the menu" />
      <Line title={food.title} line={food.body || undefined} thumb={food.photos?.[0]} last onPress={() => router.push(`/post/${food.id}`)} label={`On the menu: ${food.title}`} />
    </View>
  );
});

// Every event that repeats weekly, one row each: the weekday, the title, when and where, and the RSVP chips
// (each week has its own sign-up; a new week starts out not signed up).
const WeeklyEvents = React.memo(function WeeklyEvents() {
  const { content, fits } = useStore();
  const now = useNow();
  const list = upcoming(content.events).filter((e) => e.repeat === 'weekly' && fits(e));
  if (!list.length) return null;
  return (
    <View style={st.section}>
      <Head title="Weekly events" />
      {list.map((e, i) => <WeeklyRow key={e.id} e={e} now={now} last={i === list.length - 1} />)}
    </View>
  );
});

function WeeklyRow({ e, now, last }: { e: EventItem; now: number; last: boolean }) {
  const { openEvent } = useStore();
  const r = useRsvp(e);
  const { day, time } = dayAndTime(e, now);
  const every = day.split(' ').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' '); // "Every Sunday"
  const line = [every, time, e.place].filter(Boolean).join(' · ');
  const chips = e.signup !== 'app' ? undefined : (
    <View style={st.chips}>
      {r.mine ? <Slab size="chip" kind="outline" icon="tick" label="In" /> : r.isOut ? <Slab size="chip" kind="ghost" label="Out" /> : <Slab size="chip" label="I'm in" disabled={r.busy} onPress={r.imIn} accessibilityLabel={`I'm in: sign up for ${e.title}`} />}
      {r.isOut ? <Slab size="chip" label="I'm in" disabled={r.busy} onPress={r.imIn} accessibilityLabel={`I'm in after all: ${e.title}`} /> : <Slab size="chip" kind="ghost" label="I'm out" disabled={r.busy} onPress={r.imOut} accessibilityLabel={`I'm out: not coming to ${e.title}`} />}
    </View>
  );
  return (
    <>
      <Line title={e.title} line={line} lines={2} last={last && !r.err} onPress={() => openEvent(e.id)} label={`${e.title}, ${line}`} lead={<DayBlock date={e.start} now={now} />} right={chips} />
      {r.err ? <Text style={[st.err, { textAlign: 'left', marginBottom: 8 }]}>{r.err}</Text> : null}
    </>
  );
}

// The three newest posts (pinned first): a title and one line each.
const FromRabbi = React.memo(function FromRabbi() {
  const { content, go } = useStore();
  const posts = sortPosts(content.posts).filter((p) => p.kind !== 'Food').slice(0, 3);
  if (!posts.length) return null;
  return (
    <View style={st.section}>
      <Head title="From Rabbi Zevy" action="See all" onAction={() => go('Feed')} />
      {posts.map((p, i) => (
        <Line key={p.id} title={p.title} line={p.body || undefined} thumb={p.photos?.[0]} last={i === posts.length - 1} onPress={() => router.push(`/post/${p.id}`)} label={p.title} />
      ))}
    </View>
  );
});

// This Shabbat, compact: the two times as big as the page needs and no bigger, then the Teen Minyan.
const ShabbatBand = React.memo(function ShabbatBand() {
  const sh = useShabbat();
  const { content } = useStore();
  if (sh === 'error') return null;
  const teen = (content.minyan?.shabbat ?? MINYAN_FALLBACK.shabbat).find((r) => /teen/i.test(r.label));
  return (
    <Band style={st.shabbat}>
      <Text style={st.shabHead}>Shabbat{sh?.parsha ? ` · ${sh.parsha}` : ''}</Text>
      {sh ? (
        <View style={st.shabTimes}>
          <View style={st.shabCol}>
            <Text style={st.shabTime} numberOfLines={1}>{sh.candles ?? '—'}</Text>
            <Text style={st.shabLabel}>Candle lighting</Text>
          </View>
          <Hairline strong vertical />
          <View style={[st.shabCol, st.shabColRight]}>
            <Text style={st.shabTime} numberOfLines={1}>{sh.havdalah ?? '—'}</Text>
            <Text style={st.shabLabel}>Shabbat ends</Text>
          </View>
        </View>
      ) : <Text style={[T.small, { marginTop: 8 }]}>Loading this week's times…</Text>}
      {teen ? (
        <View style={st.shabTeen}>
          <Text style={st.shabTeenLabel} numberOfLines={1}>{teen.label} · Saturday</Text>
          <Text style={st.shabTeenTime} numberOfLines={1}>{minyanTime(teen.time, sh || null).time}</Text>
        </View>
      ) : null}
    </Band>
  );
});

const st = StyleSheet.create({
  section: { marginTop: GAP },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 6 },
  headText: { ...display(30), flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18 },
  rowRule: { borderBottomWidth: 1, borderBottomColor: C.line },
  rowLast: { paddingBottom: 4 },
  lineText: { flex: 1, minWidth: 0 },
  lineTitle: { ...display(22) },
  lineSub: { fontSize: 15, lineHeight: 21, color: C.sub, marginTop: 4 },
  thumb: { width: 60, height: 60, borderRadius: R.print, backgroundColor: C.card },
  shabbat: { marginTop: GAP, paddingVertical: 20 },
  shabHead: { fontFamily: F.bold, fontSize: 14, lineHeight: 18, letterSpacing: 1.6, color: C.sub, textTransform: 'uppercase' },
  shabTimes: { flexDirection: 'row', alignItems: 'stretch', marginTop: 14 },
  shabCol: { flex: 1 },
  shabColRight: { paddingLeft: SP.gutter },
  shabTime: { ...numeral(36), color: C.ink },
  shabLabel: { fontSize: 13, lineHeight: 17, color: C.sub, marginTop: 4 },
  shabTeen: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line },
  shabTeenLabel: { flex: 1, fontSize: 15, lineHeight: 20, fontWeight: '600', color: C.ink },
  shabTeenTime: { ...display(24, C.blue) },
  outRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  outX: { width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: C.red, alignItems: 'center', justifyContent: 'center' },
  outText: { flex: 1, minWidth: 0 },
  outWord: { ...display(46, C.red), marginTop: 2 },
  outLine: { fontSize: 15, lineHeight: 21, color: C.sub, marginTop: 2 },
  invites: { marginTop: 0, marginBottom: 14 },
  dateRow: { height: DATE_ROW, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateLine: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  carousel: { overflow: 'hidden' },
  pagerScroll: { overflow: 'hidden' },
  marker: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  bars: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bar: { width: 10, height: 6, borderRadius: 1.5, backgroundColor: C.tick, transform: [{ skewX: '-16deg' }] },
  barOn: { width: 18, backgroundColor: C.sub },
  markNum: { fontFamily: F.bold, fontSize: 11, lineHeight: 14, letterSpacing: 1.8, color: C.faint, textAlign: 'right', marginRight: -1.8 },
  // a flyer
  page: { paddingTop: 8, overflow: 'hidden' },
  tag: { marginTop: 4, alignSelf: 'flex-start' },
  title: { marginTop: 0 },
  line: { fontSize: 15, lineHeight: 20, fontWeight: '500', color: C.sub, marginTop: 6 },
  small: { marginTop: 7 },
  btn: { marginTop: 18, marginBottom: 0 },
  btnRow: { flexDirection: 'row', gap: 10 },
  btnMain: { flex: 1 },
  btnSide: { minWidth: 112 },
  chips: { gap: 6, alignItems: 'stretch' },
  panel: { marginTop: 10, marginBottom: 10, borderRadius: R.photo, overflow: 'hidden', backgroundColor: C.raised, alignItems: 'center', justifyContent: 'center' },
  panelType: { backgroundColor: C.raised },
  panelEdge: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: R.photo, borderWidth: 1, borderColor: C.printEdge },
  fill: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  panelBare: { backgroundColor: 'transparent' },
  posterPad: { padding: 12 },
  typeIn: { alignSelf: 'stretch', flex: 1, padding: 18, justifyContent: 'space-between' },
  typeBar: { width: 28, height: 5, borderRadius: 1.5, backgroundColor: C.blue, transform: [{ skewX: '-16deg' }] },
  dateNum: { ...numeral(132), marginTop: 2, marginLeft: -3, paddingRight: 16 },
  err: { fontSize: 13, lineHeight: 17, fontWeight: '700', color: C.red, textAlign: 'center' },
  emptyPage: { justifyContent: 'center', paddingBottom: 40 },
  emptyText: { ...T.body, color: C.sub, marginTop: 14 },
  emptyBtn: { marginTop: 22, alignSelf: 'flex-start' },
  more: { height: HINT_ROW, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 1 },
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
});
