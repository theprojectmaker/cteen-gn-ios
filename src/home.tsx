import React, { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { AppState, Pressable, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { C, F, SP, T, display } from './theme';
import { Icon } from './icons';
import { challengeFits, sortPosts, upcoming, useShabbat, useStore, type Challenge, type EventItem } from './store';
import { audienceLabel } from './ui';
import { Band, BrushTag, DayBlock, Hairline, Label, PosterWall as PosterWallBase, Print, Row, SectionHead, Slab, Stat, Ticks, eventPicture, hebrewDate, heroType } from './look';
import { useChallengeCard } from './rewards';
import { timeAgo } from './feed';
import { InviteCards, useMyInvites } from './invites';
import { MINYAN_FALLBACK, minyanTime } from './minyan';
import { greetingNow } from './shell';
import { clockOf, clockText, dateRange, isOver, parseDay, prettyTime, spotlight, type Spotlight } from './when';
import { nyDate, nyTime, untilText } from './zmanim';

// ───────────────────────── Home ─────────────────────────
// A page with two faces.
//   A NORMAL day leads with you: the date, a greeting, your scoreboard, then the Wall of posters.
//   An EVENT day (something is tomorrow, today, or going on right now) hands the top of the page
//   to that event: the orange brush tag says when, the title is set as big as a flyer's, its
//   poster hangs beside the one button that matters. Which day it is comes from spotlight() in
//   ./when, and nowhere else.
// Under either: the Wall (the other events, as a row of posters), what is on the menu, the
// newest posts, and this Shabbat.
export function Home() {
  const { content, go, openEvent, fits, gender, going, joined } = useStore();
  const now = useNow();
  const events = upcoming(content.events).filter(fits);
  const spot = spotlight(events, now);
  const hung = wallEvents(events, now, spot?.event.id);
  // The clock ticks once a minute, but the Wall only changes when the day or what hangs on it
  // does: it keeps the same list (and the same idea of "today") until then, so it is not redrawn.
  const wallKey = `${nyDate(new Date(now))}|${hung.map((e) => e.id + e.start).join(',')}`;
  const wall = useMemo(() => hung, [wallKey, content.events]);
  const wallNow = useMemo(() => now, [wallKey]);
  const live = content.challenges.filter((c) => c.active && challengeFits(c, gender));
  const main = live.find((c) => c.id === 'tefillin') ?? live[0];
  const others = live.filter((c) => c !== main);
  // A normal day leads with your scoreboard. Until you have joined there is nothing of yours on
  // it yet, so the posters lead and the invitation to join follows them.
  const wallFirst = !spot && (!main || !joined.includes(main.id));
  // An invitation band right above the scoreboard and the scoreboard stack into one, sharing a hairline.
  const stacked = useMyInvites().filter((v) => !spot || v.eventId !== spot.event.id).length > 0 && !wallFirst;

  const board = main ? (
    <>
      <Scoreboard ch={main} style={{ marginTop: stacked ? -1 : spot ? 20 : wallFirst ? 22 : 18 }} />
      {others.map((c, i) => <ChallengeRow key={c.id} ch={c} last={i === others.length - 1} />)}
    </>
  ) : null;
  const posters = wall.length || !spot ? (
    <>
      <SectionHead title={spot ? 'Also coming up' : 'Coming up'} action="All events" onAction={() => go('Events')} top={wallFirst ? 22 : main ? 17.5 : SP.section} />
      {wall.length ? <PosterWall events={wall} going={going} onOpen={openEvent} now={wallNow} /> : (
        <View style={st.empty}>
          <Text style={[T.h2, { color: C.sub }]}>Nothing on the calendar yet</Text>
          <Text style={[T.small, { marginTop: 6 }]}>New events are on the way. Check the feed.</Text>
        </View>
      )}
    </>
  ) : null;

  return (
    <>
      <DateLine now={now} />
      {spot ? <EventHero spot={spot} now={now} /> : <Greeting now={now} />}
      <InviteCards skipEventId={spot?.event.id} style={st.invites} />
      {wallFirst ? <>{posters}{board}</> : <>{board}{posters}</>}
      <OnTheMenu />
      <FromRabbi afterBand={wallFirst && !!main} />
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

// What hangs on the Wall: up to 6 upcoming events, featured first, then by date. The spotlight
// event is left out (it has the top of the page), and so is a one-day event that is already over;
// a weekly event that is over for today hangs on its next date.
function wallEvents(events: EventItem[], now: number, skipId?: string): EventItem[] {
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const list: EventItem[] = [];
  for (const e of events) {
    if (e.id === skipId) continue;
    if (!isOver(e, now)) { list.push(e); continue; }
    if (e.repeat !== 'weekly') continue;
    const d = parseDay(e.start);
    const next = iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7));
    if (!e.repeatUntil || !/^\d{4}-\d{2}-\d{2}$/.test(e.repeatUntil) || next <= e.repeatUntil) list.push({ ...e, start: next, end: next });
  }
  return list.sort((a, b) => Number(!!b.priority) - Number(!!a.priority) || a.start.localeCompare(b.start)).slice(0, 6);
}

// The parts of the page that do not depend on the minute are not redrawn when it turns over.
const PosterWall = React.memo(PosterWallBase);

// "WED, NOV 25" and the Hebrew date beside it.
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

// A normal day's headline: the greeting, with your name on a line of its own.
function Greeting({ now }: { now: number }) {
  const { name } = useStore();
  const first = name.trim().split(' ')[0];
  const hello = greetingNow(new Date(now));
  return <Text style={st.greeting} numberOfLines={2} accessibilityRole="header">{first ? `${hello},\n${first}` : hello}</Text>;
}

// ───────────────────────── an event day ─────────────────────────

// The event that has the page: brush tag, title, its poster, where and how much, and the one
// button. A tap anywhere that is not a button opens the event page.
function EventHero({ spot, now }: { spot: Spotlight; now: number }) {
  const { openEvent } = useStore();
  const win = useWindowDimensions();
  const e = spot.event;
  // An invitation to this very event is not a band of its own today: one line here, and the button answers it.
  const invite = useMyInvites(true).find((v) => v.eventId === e.id);
  const picture = eventPicture(e);
  const column = Math.min(win.width, 560) - SP.gutter * 2;
  const clock = clockOf(e.time);
  const typed = (e.time || '').trim();
  const manyDays = !!e.end && e.end !== e.start;
  const range = manyDays ? dateRange(e).replace(/[A-Z]{3}/g, (m) => m[0] + m.slice(1).toLowerCase()) : ''; // "Dec 10 – 11"
  // The tag carries the start time. A time it could not carry whole (a range, or words) is not lost: it joins the small line.
  const extraTime = typed && (!clock || prettyTime(typed) !== clockText(clock)) ? typed : '';
  const lead = e.place || range; // the line in bold: where it is (or, with no place, the dates it runs)
  const meta = [e.place ? range : '', extraTime, e.price, audienceLabel(e)].filter(Boolean).join(' · ');
  const title = (
    <Text style={[heroType(e.title, picture ? column : column - 86), st.heroTitle]} numberOfLines={3}
      accessibilityRole="button" accessibilityLabel={`${e.title}. ${spot.tag.toLowerCase()}.`} accessibilityHint="Opens the event">
      {e.title}
    </Text>
  );
  const facts = (
    <>
      {invite ? (
        <View style={st.heroInvite}>
          <Label tone="blue" onPress={() => router.push(`/invite/${invite.id}`)} accessibilityLabel={`Your invitation: ${invite.title}`}>You're invited</Label>
        </View>
      ) : null}
      {lead ? <Text style={st.heroPlace} numberOfLines={2}>{lead}</Text> : null}
      {meta ? <Text style={[st.heroMeta, !lead && st.heroMetaFirst]} numberOfLines={2}>{meta}</Text> : null}
      <StartsIn spot={spot} />
    </>
  );
  return (
    <Pressable onPress={() => openEvent(e.id)} accessible={false} style={({ pressed }) => pressed && st.heroPressed}>
      <BrushTag label={spot.tag} style={st.heroTag} />
      {picture ? (
        <>
          {title}
          <View style={st.heroRow}>
            <Print source={picture.source} crop={picture.kind === 'photo'} style={st.heroPrint} />
            <View style={st.heroSide}>
              {facts}
              <HeroAction e={e} />
            </View>
          </View>
        </>
      ) : (
        // No picture: the date stands where a poster would, beside the title and the facts, and the button runs the full width.
        <>
          <View style={st.heroTitleRow}>
            <View style={st.heroTitleBox}>
              {title}
              <View style={st.heroFacts}>{facts}</View>
            </View>
            <DayBlock date={e.start} big today={false} align="right" now={now} style={st.heroDay} />
          </View>
          <HeroAction e={e} />
        </>
      )}
    </Pressable>
  );
}

// "STARTS IN 1H 45M": on the day itself, once the start is under six hours away. It keeps its own
// clock so it turns over on the minute by itself.
function StartsIn({ spot }: { spot: Spotlight }) {
  const now = useNow();
  const at = spot.startsAt;
  if (at === null || spot.phase === 'tomorrow') return null;
  const clock = clockOf(spot.event.time);
  const left = at - now;
  const text = left > 0
    ? left < 6 * 3600000 ? `Starts in ${untilText(left)}` : ''
    : spot.phase === 'now' && clock ? `Started at ${clockText(clock)}` : '';
  return text ? <Label tone="orange" style={st.heroStarts}>{text}</Label> : null;
}

// The one button of an event day, wired to the same sign-up the event page uses.
function HeroAction({ e }: { e: EventItem }) {
  const { going, name, signup, goingCount, openEvent, invites: answers, respondInvite } = useStore();
  const invite = useMyInvites(true).find((v) => v.eventId === e.id);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setErr(null); }, [e.id]);
  if (e.signup !== 'app') return <Slab label="Details" onPress={() => openEvent(e.id)} style={st.heroBtn} accessibilityLabel={`Details: ${e.title}`} />;
  const mine = going.includes(e.id);
  const count = e.showGoing ? goingCount[e.id] ?? 0 : 0;
  const run = async (on: boolean) => {
    setBusy(true); setErr(null);
    const failed = await signup(e.id, on);
    // I'M IN is also the answer to an invitation to this event that is still waiting
    if (on && !failed && invite && !(answers || {})[invite.id]) await respondInvite(invite.id, 'yes');
    setErr(failed);
    setBusy(false);
  };
  return (
    <>
      {mine ? (
        <Slab kind="outline" icon="tick" label="You're in" style={st.heroBtn} accessibilityLabel={`You're in: signed up for ${e.title}`} />
      ) : (
        // no name on the profile yet: the event page asks for it first
        <Slab label="I'm in" disabled={busy} onPress={() => (name ? run(true) : openEvent(e.id))} style={st.heroBtn} accessibilityLabel={`I'm in: sign up for ${e.title}`} />
      )}
      {mine ? (
        <Pressable onPress={() => run(false)} disabled={busy} hitSlop={{ top: 10, bottom: 16, left: 24, right: 24 }} style={({ pressed }) => [st.heroQuiet, st.heroQuietTap, (pressed || busy) && st.dim]}
          accessibilityRole="button" accessibilityLabel={`Can't make it: cancel my sign-up for ${e.title}`}>
          <Text style={st.heroCant}>Can't make it</Text>
        </Pressable>
      ) : count > 0 ? (
        <View style={st.heroQuiet}><Label>{count} going</Label></View>
      ) : null}
      {err ? <Text style={st.heroErr} accessibilityLiveRegion="polite">{err}</Text> : null}
    </>
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
      <Row kicker="On the menu" title={food.title} meta={food.body || undefined} metaLines={2} thumb={photo} chevron={!photo}
        onPress={() => router.push(`/post/${food.id}`)} accessibilityLabel={`On the menu: ${food.title}`} />
    </View>
  );
});

// The three newest posts (pinned first), as rows.
const FromRabbi = React.memo(function FromRabbi({ afterBand }: { afterBand?: boolean }) {
  const { content, go, postMeta } = useStore();
  const posts = sortPosts(content.posts).filter((p) => p.kind !== 'Food').slice(0, 3);
  if (!posts.length) return null;
  return (
    <>
      <SectionHead title="From Rabbi Zevy" action="See all" onAction={() => go('Feed')} top={afterBand ? 20 : SP.section} />
      {posts.map((p, i) => {
        const comments = postMeta?.[p.id]?.comments ?? 0;
        return (
          <Row key={p.id} title={p.title} meta={p.body || undefined} metaLines={2} thumb={p.photos?.[0]} last={i === posts.length - 1}
            foot={`${p.pinned ? 'Pinned · ' : ''}${p.kind} · ${timeAgo(p.at)}${comments ? ` · ${comments} ${comments === 1 ? 'comment' : 'comments'}` : ''}`}
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

// Sizes are the mockup's (ref/mockups.html, the rules under .d1): the page starts 128 from the
// top, the tag sits 14 under the date line, the title 11 under the tag, the poster row 17 under
// the title, the scoreboard 20 under that.
const st = StyleSheet.create({
  dateLine: { height: 13, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: -0.5, marginBottom: 0.5 },
  greeting: { ...display(34), lineHeight: 33, marginTop: 8 },
  invites: { marginTop: 20, marginBottom: 0 },
  empty: { paddingTop: 14, paddingBottom: 4 },
  // the event that has the page
  heroPressed: { opacity: 0.86 },
  heroTag: { marginTop: 14 },
  heroTitle: { marginTop: 10.5 },
  heroTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  heroTitleBox: { flex: 1, minWidth: 0 },
  heroDay: { marginTop: 15 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 20, marginTop: 16.75 },
  heroPrint: { marginLeft: 5 },
  heroSide: { flex: 1, minWidth: 0, paddingTop: 4 },
  heroFacts: { marginTop: 12 },
  heroPlace: { fontSize: 16, lineHeight: 20, fontWeight: '600', color: C.ink },
  heroMeta: { fontSize: 13.5, lineHeight: 18, fontWeight: '500', color: C.sub, marginTop: 4 },
  heroMetaFirst: { marginTop: 1 },
  heroStarts: { marginTop: 6 },
  heroBtn: { marginTop: 13 },
  heroQuiet: { alignSelf: 'center', alignItems: 'center', marginTop: 11 },
  heroQuietTap: { marginTop: 9.5 }, // its taller line keeps the words where the mockup has them
  heroInvite: { alignSelf: 'flex-start', marginBottom: 5 },
  heroCant: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: C.sub },
  heroErr: { fontSize: 13, lineHeight: 17, fontWeight: '700', color: C.red, marginTop: 8, textAlign: 'center' },
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
