import React, { useCallback, useEffect, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Animated, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C, R, T, F } from './theme';
import { Icon } from './icons';
import { CHAPTER, calendarUrl, challengeFits, countdown, dateLabel, open, sortPosts, tap, upcoming, useShabbat, useStore, type ColorKey, type EventItem, type Post } from './store';
import { audienceLabel, Button, Card, Chips, Cover, Empty, EventCard, EventMeta, Field, IconTile, ScopeBadge, SectionHead, Sheet, s as u } from './ui';
import { ChallengeBanner, NameGate } from './rewards';
import { PostCard, timeAgo } from './feed';
import { InviteCards } from './invites';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';
import { MINYAN_FALLBACK, MinyanCard, minyanTime } from './minyan';
import { greetingNow } from './shell';

// ───────────────────────── Home ─────────────────────────
// One thing per section, lots of room: who you are, what's next, your challenge,
// the newest post, Shabbat, then the shortcuts at the bottom.
export function Home() {
  const { content, go, openEvent, name, push, turnOnPush, fits, gender } = useStore();
  const up = upcoming(content.events).filter(fits);
  const next = up.find((e) => e.scope === 'gn') ?? up[0];
  const coming = next ? [next, ...up.filter((e) => e.id !== next.id)].slice(0, 3) : [];
  const live = content.challenges.filter((c) => c.active && challengeFits(c, gender));
  const posts = sortPosts(content.posts).filter((p) => p.kind !== 'Food');
  const food = [...content.posts].filter((p) => p.kind === 'Food' && Date.now() - new Date(p.at).getTime() < 4 * 864e5).sort((a, b) => b.at.localeCompare(a.at))[0];
  const first = name.trim().split(' ')[0];
  const today = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York' });
  return (
    <>
      <View style={st.helloRow}>
        <Text style={st.helloSmall} numberOfLines={1} accessibilityRole="header">{greetingNow()}{first ? `, ${first}` : ''}</Text>
        <Text style={st.todaySmall}>{today}</Text>
      </View>
      <InviteCards />

      {food ? (
        <Pressable onPress={() => router.push(`/post/${food.id}`)} style={({ pressed }) => [st.food, pressed && u.pressed]} accessibilityRole="button" accessibilityLabel={`On the menu: ${food.title}`}>
          <View style={st.foodIcon}><Icon name="food" size={22} color="#9A5A16" stroke={2.1} /></View>
          <View style={{ flex: 1 }}>
            <Text style={st.foodEyebrow}>On the menu</Text>
            <Text style={st.foodTitle} numberOfLines={2}>{food.title}</Text>
            {food.body ? <Text style={T.small} numberOfLines={2}>{food.body}</Text> : null}
          </View>
        </Pressable>
      ) : null}

      {coming.length ? <EventsCarousel events={coming} onOpen={openEvent} /> : null}

      {live.length ? (
        <>
          <Text style={st.homeSection}>Today</Text>
          <View style={{ gap: 12 }}>
            {live.map((c) => <ChallengeBanner key={c.id} ch={c} />)}
          </View>
        </>
      ) : null}

      {posts.length ? (
        <>
          <View style={st.homeHeadRow}>
            <Text style={[st.homeSection, { marginTop: 0, marginBottom: 0, flex: 1 }]}>From Rabbi Zevy</Text>
            <Pressable onPress={() => go('Feed')} hitSlop={10} accessibilityRole="button"><Text style={u.link}>See all</Text></Pressable>
          </View>
          <View style={st.latest}>
            {posts.slice(0, 2).map((p, i) => (
              <Pressable key={p.id} onPress={() => router.push(`/post/${p.id}`)} style={({ pressed }) => [st.latestRow, i > 0 && st.rule, pressed && { backgroundColor: C.bg }]} accessibilityRole="button" accessibilityLabel={p.title}>
                
                <View style={{ flex: 1 }}>
                  <Text style={T.h3} numberOfLines={1}>{p.title}</Text>
                  <Text style={T.small} numberOfLines={1}>{p.pinned ? 'Pinned · ' : ''}{p.kind} · {timeAgo(p.at)}</Text>
                </View>
                <Icon name="right" size={16} color={C.faint} stroke={2.4} />
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <Text style={st.homeSection}>This Shabbat</Text>
      <ShabbatCard />

    </>
  );
}

function Quick({ icon, color, label, onPress }: { icon: string; color: ColorKey; label: string; onPress: () => void }) {
  return (
    <Card style={st.quick} onPress={onPress} label={label}>
      <IconTile icon={icon} color={color} size={46} />
      <Text style={st.quickLabel}>{label}</Text>
      <Icon name="right" size={16} color={C.faint} stroke={2.4} />
    </Card>
  );
}

function ShabbatCard() {
  const sh = useShabbat();
  if (sh === 'error') return null;
  return (
    <Card style={st.shabbat}>
      <IconTile icon="flame" color="orange" size={42} />
      <View style={{ flex: 1 }}>
        <Text style={T.eyebrow}>Shabbat in Great Neck{sh?.parsha ? ` · ${sh.parsha}` : ''}</Text>
        {sh ? (
          <View style={st.shabbatTimes}>
            <View>
              <Text style={st.timeBig}>{sh.candles ?? '—'}</Text>
              <Text style={T.small}>Candle lighting</Text>
            </View>
            <View style={st.timeRule} />
            <View>
              <Text style={st.timeBig}>{sh.havdalah ?? '—'}</Text>
              <Text style={T.small}>Shabbat ends</Text>
            </View>
          </View>
        ) : <Text style={[T.small, { marginTop: 6 }]}>Loading this week's times…</Text>}
      </View>
    </Card>
  );
}

// ───────────────────────── Events ─────────────────────────
const EVENT_FILTERS = ['All', 'Great Neck', 'Saved'] as const;

export function Events() {
  const { saved, content, fits, markEventsSeen, gender } = useStore();
  const notForMe = content.challenges.filter((c) => c.active && !challengeFits(c, gender));
  useFocusEffect(useCallback(() => { markEventsSeen(); }, [markEventsSeen]));
  const [f, setF] = useState<(typeof EVENT_FILTERS)[number]>('All');
  const list = upcoming(content.events).filter(fits).filter((e) => (f === 'All' ? true : f === 'Saved' ? saved.includes(e.id) : f === 'Great Neck' ? e.scope === 'gn' : e.scope === 'intl'));
  return (
    <>
      <Text style={T.h1}>Events</Text>
      <Text style={[T.small, { marginTop: 4, marginBottom: 14 }]}>What's coming up in Great Neck and around CTeen</Text>
      <InviteCards eventOnly />
      <Chips options={EVENT_FILTERS} value={f} onChange={setF} />
      <View style={{ gap: 26, marginTop: 18 }}>
        {list.map((e) => <EventCard key={e.id} e={e} />)}
      </View>
      {f === 'All' && notForMe.length ? (
        <View style={{ marginTop: 30, gap: 12 }}>
          {notForMe.map((c) => (
            <View key={c.id} style={st.notApplicable} accessibilityLabel={`${c.title}. For boys, not applicable.`}>
              <View style={st.naIcon}><Icon name="tefillin" size={22} color={C.faint} stroke={2} /></View>
              <View style={{ flex: 1 }}>
                <Text style={[T.h3, { color: C.sub }]}>{c.title}</Text>
                <Text style={T.small}>For boys</Text>
              </View>
              <View style={st.naPill}><Text style={st.naText}>Not applicable</Text></View>
            </View>
          ))}
        </View>
      ) : null}
      {list.length === 0 ? (
        <Empty icon={f === 'Saved' ? 'heart' : 'calendar'} title={f === 'Saved' ? 'No saved events yet' : 'Nothing here right now'} body={f === 'Saved' ? 'Tap the heart on an event to keep it here.' : 'New events are on the way. Check the feed.'} />
      ) : null}
    </>
  );
}

// Event details, shown in a slide-up sheet (app/event/[id].tsx).
export function EventDetails({ e }: { e: EventItem }) {
  return (
    <>
      <View style={st.sheetImgWrap}>
        <Cover e={e} style={u.fill} iconSize={96} />
        {e.image ? <View style={[u.fill, { backgroundColor: 'rgba(19,32,44,0.32)' }]} /> : null}
        <ScopeBadge scope={e.scope} style={{ position: 'absolute', left: 16, top: 16 }} />
        <Text style={st.sheetTitle}>{e.title}</Text>
      </View>
      <View style={{ padding: 18, paddingBottom: 28 }}>
        <Card style={{ padding: 0 }}>
          <Row icon="calendar" label="When" value={dateLabel(e) + (e.time ? ` · ${e.time}` : '')} first />
          {audienceLabel(e) ? <Row icon="users" label="For" value={audienceLabel(e)} /> : null}
          {e.place ? <Row icon="pin" label="Where" value={e.place} /> : null}
          {e.price ? <Row icon="ticket" label="Price" value={e.price} /> : null}
          <Row icon="clock" label="Starts" value={countdown(e)} />
        </Card>
        {e.who ? <Para title="Who it's for" body={e.who} /> : null}
        {e.about ? <Para title="About" body={e.about} /> : null}
        <View style={{ marginTop: 20 }}>
          {e.signup === 'app' ? <InAppSignup e={e} /> : <WebsiteSignup e={e} />}
        </View>
        <View style={{ marginTop: 10 }}>
          <Button kind="ghost" icon="calendar" label="Add to Apple Calendar" onPress={() => open(calendarUrl(e))} />
        </View>
      </View>
    </>
  );
}

// Great Neck events: RSVP right here in one tap (your name comes from your profile); the rabbi
// sees the list, everyone sees how many are going.
function InAppSignup({ e }: { e: EventItem }) {
  const { going, name, signup, goingCount, goingNames } = useStore();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);
  const mine = going.includes(e.id);
  const count = e.showGoing ? goingCount[e.id] ?? 0 : 0;
  const names = e.showGoing ? goingNames[e.id] ?? [] : [];
  const run = async (on: boolean) => {
    setBusy(true); setErr(null);
    setErr(await signup(e.id, on));
    setBusy(false);
  };
  useEffect(() => { setAsk(false); setErr(null); setDeclined(false); }, [e.id]);
  if (ask) return <Card><NameGate title="Who's going?" cta="I'm going" onDone={() => { setAsk(false); run(true); }} /></Card>;
  const others = Math.max(0, count - (mine ? 1 : 0));
  return (
    <View>
      <View style={st.rsvp}>
        <View style={st.rsvpHead}>
          <Text style={[T.h2, { flex: 1 }]}>{mine ? "You're going" : declined ? 'Maybe next time' : 'Are you going?'}</Text>
          {count > 0 ? (
            <View style={st.goingPill}>
              <Icon name="users" size={14} color={C.blueDeep} stroke={2.2} />
              <Text style={st.goingPillText}>{count} going</Text>
            </View>
          ) : null}
        </View>
        <View style={st.rsvpRow}>
          <Pressable
            onPress={() => { if (mine) return; setDeclined(false); name ? run(true) : setAsk(true); }}
            disabled={busy}
            style={({ pressed }) => [st.rsvpBtn, mine && st.rsvpYes, pressed && { transform: [{ scale: 0.97 }] }]}
            accessibilityRole="button" accessibilityState={{ selected: mine }}>
            <Icon name={mine ? 'tick' : 'check'} size={18} color={mine ? C.white : C.ink} stroke={2.4} />
            <Text style={[st.rsvpText, mine && { color: C.white }]}>{busy && !mine ? 'Saving…' : 'Going'}</Text>
          </Pressable>
          <Pressable
            onPress={() => { setDeclined(true); if (mine) run(false); }}
            disabled={busy}
            style={({ pressed }) => [st.rsvpBtn, declined && !mine && st.rsvpNo, pressed && { transform: [{ scale: 0.97 }] }]}
            accessibilityRole="button" accessibilityState={{ selected: declined && !mine }}>
            <Icon name="x" size={17} color={declined && !mine ? C.onInverse : C.ink} stroke={2.4} />
            <Text style={[st.rsvpText, declined && !mine && { color: C.onInverse }]}>Can't go</Text>
          </Pressable>
        </View>
        {names.length ? <Text style={st.goingNames} numberOfLines={2}>{names.slice(0, 4).join(', ')}{names.length > 4 ? ` and ${names.length - 4} more` : ''}</Text> : null}
        <Text style={st.rsvpNote}>
          {!e.showGoing ? (mine ? 'Rabbi Zevy has you on the list.' : 'Tap Going and Rabbi Zevy saves you a spot.') : mine ? `Rabbi Zevy has you on the list.${others > 0 ? ` You and ${others} other${others === 1 ? '' : 's'} are going.` : ''}` : count > 0 ? `${count} from Great Neck ${count === 1 ? 'is' : 'are'} going so far.` : 'Be the first to RSVP.'}
        </Text>
      </View>
      {err ? <Text style={st.err} accessibilityLiveRegion="polite">{err}</Text> : null}
      {e.payUrl ? (
        <View style={{ marginTop: 10 }}>
          <Button kind="ghost" icon="ticket" label={mine ? 'Next: get your ticket' : 'Ticket info'} onPress={() => open(e.payUrl!)} />
        </View>
      ) : null}
    </View>
  );
}

// International events: registration happens on the CTeen website.
function WebsiteSignup({ e }: { e: EventItem }) {
  return (
    <View>
      <View style={st.intlNote}>
        <Icon name="globe" size={20} color={C.sub} />
        <Text style={[T.small, { flex: 1, color: C.ink }]}>This is an international CTeen event. Registration happens on the CTeen website.</Text>
      </View>
      {e.url ? (
        <View style={{ marginTop: 10 }}>
          <Button label="Register on the CTeen website" icon="external" color={C.night} onPress={() => open(e.url!)} />
        </View>
      ) : null}
    </View>
  );
}

function Row({ icon, label, value, first }: { icon: string; label: string; value: string; first?: boolean }) {
  return (
    <View style={[st.row, !first && st.rule]}>
      <Icon name={icon} size={18} color={C.sub} />
      <Text style={[T.small, { fontSize: 14 }]}>{label}</Text>
      <Text style={[T.h3, { fontSize: 14, flex: 1, textAlign: 'right' }]}>{value}</Text>
    </View>
  );
}

function Para({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ marginTop: 20 }}>
      <Text style={T.eyebrow}>{title}</Text>
      <Text style={[T.body, { marginTop: 6 }]}>{body}</Text>
    </View>
  );
}

// ───────────────────────── Feed ─────────────────────────
// Home: the next events, one big photo card at a time, sliding by itself every few seconds.
function EventsCarousel({ events, onOpen }: { events: EventItem[]; onOpen: (id: string) => void }) {
  const [w, setW] = useState(0);
  const [page, setPage] = useState(0);
  const ref = React.useRef<ScrollView>(null);
  const touching = React.useRef(false);
  useEffect(() => {
    if (events.length < 2 || !w) return;
    const t = setInterval(() => {
      if (touching.current) return;
      setPage((p) => {
        const n = (p + 1) % events.length;
        ref.current?.scrollTo({ x: n * w, animated: true });
        return n;
      });
    }, 4500);
    return () => clearInterval(t);
  }, [events.length, w]);
  return (
    <View style={{ marginTop: 8 }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <ScrollView ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false} decelerationRate="fast"
        onScrollBeginDrag={() => { touching.current = true; }}
        onMomentumScrollEnd={(e) => { touching.current = false; if (w) setPage(Math.round(e.nativeEvent.contentOffset.x / w)); }}
        style={st.carousel}>
        {events.map((ev, i) => (
          <Pressable key={ev.id} onPress={() => onOpen(ev.id)} style={({ pressed }) => [st.hero, { width: w || 1 }, pressed && { opacity: 0.95 }]} accessibilityRole="button" accessibilityLabel={ev.title}>
            <Cover e={ev} style={StyleSheet.absoluteFill} iconSize={150} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: ev.image ? 'rgba(13,60,110,0.42)' : 'rgba(19,32,44,0.18)' }]} />
            <View style={st.heroTopRow}>
              <View style={st.upNext}><Text style={st.upNextText}>{i === 0 ? 'Up next' : 'Coming up'}</Text></View>
              <ScopeBadge scope={ev.scope} />
            </View>
            <Text style={st.heroKicker}>{countdown(ev)}</Text>
            <Text style={st.heroTitle} numberOfLines={2}>{ev.title}</Text>
            <Text style={st.heroDate}>{dateLabel(ev)}{ev.time ? ` · ${ev.time}` : ''}</Text>
            <View style={st.heroBtn}>
              <Text style={st.heroBtnText}>{ev.signup === 'app' ? 'RSVP' : 'View details'}</Text>
              <Icon name="right" size={15} color={C.night} stroke={2.4} />
            </View>
          </Pressable>
        ))}
      </ScrollView>
      {events.length > 1 ? (
        <View style={st.carDots}>{events.map((_, i) => <View key={i} style={[st.carDot, i === page && st.carDotOn]} />)}</View>
      ) : null}
    </View>
  );
}

// Shown on Home until your account is linked with Apple, so a new phone keeps your streak and RSVPs.
function LinkAppleCard() {
  const { account, appleReady, signInWithApple } = useStore();
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!appleReady || account?.apple || hidden) return null;
  return (
    <View style={st.appleCard}>
      <View style={st.appleBadge}><Text style={st.appleGlyph}>{'\uF8FF'}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={T.h3}>Link your Apple account</Text>
        <Text style={T.small}>{err ?? 'Keep your streak and RSVPs if you ever get a new phone.'}</Text>
      </View>
      <Pressable onPress={async () => { setBusy(true); setErr(await signInWithApple()); setBusy(false); }} disabled={busy} style={({ pressed }) => [st.appleBtn, pressed && { opacity: 0.85 }]} accessibilityRole="button" accessibilityLabel="Link with Apple">
        <Text style={st.appleBtnText}>{busy ? '…' : 'Link'}</Text>
      </Pressable>
      <Pressable onPress={() => setHidden(true)} hitSlop={10} style={st.appleX} accessibilityRole="button" accessibilityLabel="Not now">
        <Icon name="x" size={13} color={C.faint} stroke={2.4} />
      </Pressable>
    </View>
  );
}

// Feed and post cards live in feed.tsx.
export { Feed, PostCard } from './feed';

// ───────────────────────── Chapter ─────────────────────────
// Chapter tab: who runs it, this Shabbat, what's next, how to reach us. Real content, iOS-style lists.
export function Chapter() {
  const { content, leader, setAdminOpen, online, openEvent, fits } = useStore();
  const sh = useShabbat();
  const shab = sh && sh !== 'error' ? sh : null;
  const [askOpen, setAskOpen] = useState(0);
  const [shulOpen, setShulOpen] = useState(false);
  const m = content.minyan ?? MINYAN_FALLBACK;
  const teen = m.shabbat.find((r) => /teen/i.test(r.label)) ?? m.weekday.find((r) => /teen/i.test(r.label));
  const shul = { weekday: m.weekday.filter((r) => r !== teen), shabbat: m.shabbat.filter((r) => r !== teen) };
  const clock = (ms?: number) => (ms ? new Date(ms).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }) : '');
  const next = upcoming(content.events).filter(fits).find((e) => e.scope === 'gn');
  // days until Shabbat morning (0 on Shabbat)
  const dow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })).getDay();
  const toShabbat = (6 - dow + 7) % 7;
  return (
    <>
      <View style={st.pageHead}>
        <Image source={require('../assets/logo.png')} style={st.pageLogo} resizeMode="contain" />
        <View style={{ flex: 1 }}>
          <Text style={st.pageTitle}>{CHAPTER.name}</Text>
          <Text style={st.pageSub}>{CHAPTER.org} · 400 East Shore Road</Text>
        </View>
      </View>

      {/* this Shabbat: the Teen Minyan front and center */}
      <View style={st.shabCard}>
        <View style={st.shabTop}>
          <Text style={st.shabEyebrow}>This Shabbat{shab?.parsha ? ` · ${shab.parsha}` : ''}</Text>
          <Text style={st.shabWhen}>{toShabbat === 0 ? 'Today' : toShabbat === 1 ? 'Tomorrow' : `In ${toShabbat} days`}</Text>
        </View>
        <View style={st.shabMain}>
          <View style={{ flex: 1 }}>
            <Text style={st.shabTitle}>{teen?.label ?? 'Teen Minyan'}</Text>
            <Text style={st.shabSub}>Shabbat morning at the Chabad house</Text>
          </View>
          <Text style={st.shabTime}>{teen?.time ? minyanTime(teen.time, shab).time : '10:00 AM'}</Text>
        </View>
        <View style={st.shabRow}>
          <View style={st.shabCell}><Text style={st.shabCellLabel}>Candle lighting</Text><Text style={st.shabCellValue}>{clock(shab?.candlesAt) || '—'}</Text></View>
          <View style={st.shabDivider} />
          <View style={st.shabCell}><Text style={st.shabCellLabel}>Shabbat ends</Text><Text style={st.shabCellValue}>{clock(shab?.havdalahAt) || '—'}</Text></View>
        </View>
      </View>

      {/* the people who run it */}
      <View style={st.rabbiCard}>
        <View style={st.avatars}>
          <View style={[st.avatar, { backgroundColor: C.blue }]}><Text style={st.avatarText}>Z</Text></View>
          <View style={[st.avatar, st.avatar2, { backgroundColor: C.orange }]}><Text style={st.avatarText}>S</Text></View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.rabbiName}>Rabbi Zevy & Shani</Text>
          <Text style={st.rabbiSub}>Run CTeen Great Neck</Text>
        </View>
        <Pressable onPress={() => open('tel:' + CHAPTER.phone.replace(/\D/g, ''))} style={({ pressed }) => [st.pillBtn, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel="Call"><Icon name="phone" size={16} color={C.blue} stroke={2.2} /></Pressable>
        <Pressable onPress={() => setAskOpen((n) => n + 1)} style={({ pressed }) => [st.pillBtn, st.pillAsk, pressed && { opacity: 0.85 }]} accessibilityRole="button"><Text style={st.pillAskText}>Ask</Text></Pressable>
      </View>
      <AskRabbi openSignal={askOpen} />

      {next ? (
        <>
          <GroupLabel text="Next at the Chabad house" />
          <Pressable onPress={() => openEvent(next.id)} style={({ pressed }) => [st.nextCard, pressed && { opacity: 0.9 }]} accessibilityRole="button" accessibilityLabel={next.title}>
            <Cover e={next} style={st.nextImg} iconSize={28} />
            <View style={{ flex: 1 }}>
              <Text style={st.nextTitle} numberOfLines={2}>{next.title}</Text>
              <Text style={st.gSub}>{dateLabel(next)}{next.time ? ` · ${next.time}` : ''}</Text>
            </View>
            <Icon name="right" size={14} color={C.faint} stroke={2.4} />
          </Pressable>
        </>
      ) : null}

      <GroupLabel text="Visit and reach us" />
      <View style={st.group}>
        <GRow icon="pin" tile="#FF4D4F" title="Directions" sub={CHAPTER.address} onPress={() => open('https://maps.apple.com/?q=' + encodeURIComponent(CHAPTER.org + ', ' + CHAPTER.address))} chevron="right" first />
        <GRow icon="phone" tile="#34C759" title="Call the Chabad house" value={CHAPTER.phone} onPress={() => open('tel:' + CHAPTER.phone.replace(/\D/g, ''))} />
        <GRow icon="camera" tile="#E1306C" title="Instagram" value={CHAPTER.instagramHandle} onPress={() => open(CHAPTER.instagram)} />
        <GRow icon="clock" tile="#5856D6" title="Shul schedule" sub="Shacharit, Mincha, Maariv" onPress={() => setShulOpen((o) => !o)} chevron={shulOpen ? 'down' : 'right'} />
        {shulOpen ? (
          <View style={st.shul}>
            {[...shul.weekday.map((r) => ({ ...r, day: 'Weekdays' })), ...shul.shabbat.map((r) => ({ ...r, day: 'Shabbat' }))].map((r, i) => {
              const t = r.time ? minyanTime(r.time, shab) : null;
              return (
                <View key={r.label + i} style={st.shulRow}>
                  <Text style={st.shulLabel}>{r.label}<Text style={st.shulDay}>  {r.day}</Text></Text>
                  <Text style={[st.shulTime, !t && { color: C.faint, fontWeight: '600' }]}>{t ? t.time : 'Call for times'}</Text>
                </View>
              );
            })}
            {m.note ? <Text style={st.shulNote}>{m.note}</Text> : null}
          </View>
        ) : null}
      </View>

      {content.info.length ? (
        <>
          <GroupLabel text="About CTeen" />
          <View style={st.group}>
            {content.info.map((i, n) => <InfoRow key={i.id} icon={i.icon} title={i.title} body={i.body} first={n === 0} />)}
          </View>
        </>
      ) : null}

      <GroupLabel text="More" />
      <View style={st.group}>
        <GRow icon="users" tile="#1877F2" title="Facebook" onPress={() => open(CHAPTER.facebook)} chevron="right" first />
        <GRow icon="globe" tile={C.blue} title="CTeen portal" sub="International events, service hours" onPress={() => open(CHAPTER.portal)} chevron="right" />
        <GRow icon="external" tile="#8E8E93" title="Chapter sign-up" onPress={() => open(CHAPTER.join)} chevron="right" />
        <GRow icon="gift" tile={C.orange} title="Donate" onPress={() => open(CHAPTER.donate)} chevron="right" />
      </View>

      <Pressable onPress={() => setAdminOpen(true)} style={st.leaderLink} hitSlop={8} accessibilityRole="button">
        <Text style={[st.leaderText, { color: C.faint, fontWeight: '600' }]}>{leader ? 'Open leader panel' : 'Leader sign-in'}</Text>
      </Pressable>
      {online === false ? <Text style={st.endNote}>Offline: showing the last saved info</Text> : null}
    </>
  );
}

function GroupLabel({ text }: { text: string }) {
  return <Text style={st.groupLabel}>{text}</Text>;
}

// One row in a grouped list: a small colored icon square (like iOS Settings), title + subtitle, value or chevron.
function GRow({ icon, tile, title, sub, value, onPress, chevron, first }: { icon?: string; tile?: string; title: string; sub?: string; value?: string; onPress?: () => void; chevron?: 'right' | 'down'; first?: boolean }) {
  const body = (
    <>
      <View style={[st.gBody, !first && st.gRule]}>
        <View style={{ flex: 1 }}>
          <Text style={st.gTitle}>{title}</Text>
          {sub ? <Text style={st.gSub} numberOfLines={1}>{sub}</Text> : null}
        </View>
        {value ? <Text style={st.gValue}>{value}</Text> : null}
        {chevron ? <View style={{ transform: [{ rotate: chevron === 'down' ? '90deg' : '0deg' }] }}><Icon name="right" size={14} color={C.faint} stroke={2.4} /></View> : null}
      </View>
    </>
  );
  if (!onPress) return <View style={st.gRow}>{body}</View>;
  return <Pressable onPress={onPress} style={({ pressed }) => [st.gRow, pressed && { backgroundColor: C.bg }]} accessibilityRole="button">{body}</Pressable>;
}

// A "Good to know" item: just the title until you tap it.
function InfoRow({ icon, title, body, first }: { icon: string; title: string; body: string; first?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable onPress={() => setOpen((o) => !o)} style={({ pressed }) => [st.gRow, { alignItems: 'flex-start' }, pressed && { backgroundColor: C.bg }]} accessibilityRole="button" accessibilityState={{ expanded: open }}>
      <View style={[st.gBody, !first && st.gRule, { alignItems: 'flex-start' }]}>
        <View style={{ flex: 1 }}>
          <Text style={st.gTitle}>{title}</Text>
          {open ? <Text style={[st.gSub, { lineHeight: 19, marginTop: 4 }]}>{body}</Text> : null}
        </View>
        <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }], marginTop: 3 }}><Icon name="right" size={14} color={C.faint} stroke={2.4} /></View>
      </View>
    </Pressable>
  );
}

function MoreRow({ icon, title, url, first }: { icon: string; title: string; url: string; first?: boolean }) {
  return (
    <Pressable onPress={() => open(url)} style={({ pressed }) => [st.chInfoRow, { alignItems: 'center' }, !first && st.rule, pressed && { backgroundColor: C.bg }]} accessibilityRole="link">
      <Icon name={icon} size={19} color={C.sub} stroke={2} />
      <Text style={[st.chInfoTitle, { flex: 1 }]}>{title}</Text>
      <Icon name="right" size={16} color={C.faint} stroke={2.4} />
    </Pressable>
  );
}

function AskRabbi({ openSignal = 0 }: { openSignal?: number }) {
  const { name, ask } = useStore();
  const [openForm, setOpenForm] = useState(false);
  useEffect(() => { if (openSignal) setOpenForm(true); }, [openSignal]);
  const [needName, setNeedName] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const send = async () => {
    if (!name) return setNeedName(true);
    setBusy(true);
    const err = await ask(text.trim());
    setBusy(false);
    if (err) return setNote(err);
    setText(''); setOpenForm(false); setNote('Sent. Rabbi Zevy will see it.');
  };
  if (!openForm && !needName && !note) return null; // the Ask button on the Chapter page opens it
  return (
    <>
      <Text style={st.homeSection}>Ask the rabbi</Text>
      {needName ? <Card><NameGate title="Who's asking?" onDone={() => setNeedName(false)} /></Card> : !openForm ? (
        <Card style={st.askRow} onPress={() => { setOpenForm(true); setNote(null); }} label="Ask the rabbi a question">
          <IconTile icon="question" color="purple" size={40} />
          <View style={{ flex: 1 }}>
            <Text style={T.h3}>Got a question?</Text>
            <Text style={T.small}>{note ?? 'Anything about Judaism, life or CTeen. It goes straight to Rabbi Zevy.'}</Text>
          </View>
          <Icon name="right" size={17} color={C.faint} stroke={2.4} />
        </Card>
      ) : (
        <Card>
          <Field label="Your question" value={text} onChange={setText} multiline placeholder="Type it here" />
          {note ? <Text style={st.err}>{note}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <View style={{ flex: 1 }}><Button kind="ghost" label="Cancel" onPress={() => setOpenForm(false)} /></View>
            <View style={{ flex: 1 }}><Button label={busy ? 'Sending…' : 'Send'} icon="send" disabled={busy || text.trim().length < 3} onPress={send} /></View>
          </View>
        </Card>
      )}
    </>
  );
}

function LinkRow({ icon, title, sub, url, first }: { icon: string; title: string; sub: string; url: string; first?: boolean }) {
  return (
    <Pressable onPress={() => open(url)} style={({ pressed }) => [st.linkRow, !first && st.rule, pressed && { backgroundColor: C.bg }]} accessibilityRole="link" accessibilityLabel={`${title}: ${sub}`}>
      <IconTile icon={icon} size={40} />
      <View style={{ flex: 1 }}>
        <Text style={T.h3}>{title}</Text>
        <Text style={T.small} numberOfLines={1}>{sub}</Text>
      </View>
      <Icon name="right" size={17} color={C.faint} stroke={2.4} />
    </Pressable>
  );
}

const st = StyleSheet.create({
  pageHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2, marginBottom: 18 },
  pageLogo: { width: 30, height: 53 },
  pageTitle: { fontSize: 27, fontFamily: F.display, color: C.ink, letterSpacing: -0.6 },
  pageSub: { fontSize: 14, color: C.sub, marginTop: 1 },
  shabCard: { borderRadius: 22, backgroundColor: C.card, padding: 18, shadowColor: '#0F1D2B', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  shabTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shabEyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: C.orange },
  shabWhen: { fontSize: 12, fontWeight: '800', color: C.orange, backgroundColor: C.orangePale, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  shabMain: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  shabTitle: { fontSize: 22, fontFamily: F.display, color: C.ink, letterSpacing: -0.3 },
  shabSub: { fontSize: 13, color: C.sub, marginTop: 2 },
  shabTime: { fontSize: 26, fontFamily: F.display, color: C.ink, fontVariant: ['tabular-nums'] },
  shabRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  shabCell: { flex: 1 },
  shabCellLabel: { fontSize: 12, color: C.sub, fontWeight: '600' },
  shabCellValue: { fontSize: 17, fontWeight: '800', color: C.ink, marginTop: 2, fontVariant: ['tabular-nums'] },
  shabDivider: { width: StyleSheet.hairlineWidth, height: 32, backgroundColor: C.line, marginHorizontal: 14 },
  rabbiCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, padding: 14, borderRadius: 22, backgroundColor: C.card },
  avatars: { flexDirection: 'row', width: 62 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.card },
  avatar2: { marginLeft: -14 },
  avatarText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  rabbiName: { fontSize: 16, fontWeight: '800', color: C.ink },
  rabbiSub: { fontSize: 13, color: C.sub, marginTop: 1 },
  pillBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.bluePale, alignItems: 'center', justifyContent: 'center' },
  pillAsk: { width: undefined, paddingHorizontal: 16, backgroundColor: C.blue },
  pillAskText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  nextCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, paddingRight: 14, borderRadius: 18, backgroundColor: C.card },
  nextImg: { width: 64, height: 64, borderRadius: 12 },
  nextTitle: { fontSize: 16, fontWeight: '800', color: C.ink },
  gRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16 },
  gTile: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  gBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingRight: 14, minHeight: 52 },
  gRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
  idLogo: { width: 56, height: 56, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  idLogoImg: { width: 24, height: 42 },
  idName: { fontSize: 26, fontFamily: F.display, color: C.ink, letterSpacing: -0.5 },
  idSub: { fontSize: 14, color: C.sub, marginTop: 1 },
  idAbout: { fontSize: 15, lineHeight: 21, color: C.sub, marginTop: 14 },
  groupLabel: { fontSize: 13, fontWeight: '600', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 28, marginBottom: 8, marginLeft: 16 },
  group: { borderRadius: 18, backgroundColor: C.card, overflow: 'hidden' },
  gTitle: { fontSize: 16, color: C.ink },
  gSub: { fontSize: 13, color: C.sub, marginTop: 1 },
  gValue: { fontSize: 16, color: C.sub, fontVariant: ['tabular-nums'] },
  gValueStrong: { color: C.ink, fontWeight: '700' },
  gLink: { fontSize: 15, color: C.blue, fontWeight: '600' },
  shul: { paddingHorizontal: 16, paddingBottom: 12, marginLeft: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, paddingLeft: 0, paddingTop: 6 },
  shulRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 6, gap: 10 },
  shulLabel: { flex: 1, fontSize: 14, color: C.ink },
  shulDay: { fontSize: 12, color: C.faint },
  shulTime: { fontSize: 14, color: C.ink, fontWeight: '700', fontVariant: ['tabular-nums'] },
  shulNote: { fontSize: 12, lineHeight: 17, color: C.sub, marginTop: 8 },
  chHero: { height: 220, borderRadius: 28, overflow: 'hidden', backgroundColor: C.blueDeep, justifyContent: 'flex-end' },
  chShade: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(8,20,32,0.38)' },
  chHeroText: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  chLogoWrap: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  chLogo: { width: 20, height: 36 },
  chName: { fontSize: 22, fontFamily: F.display, color: '#FFFFFF', letterSpacing: -0.3 },
  chWith: { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '600', marginTop: 1 },
  chAbout: { fontSize: 15, lineHeight: 21, color: C.sub, marginTop: 14 },
  chActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  chAction: { alignItems: 'center', gap: 6, flex: 1 },
  chActionIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.bluePale, alignItems: 'center', justifyContent: 'center' },
  chActionText: { fontSize: 12, fontWeight: '700', color: C.ink },
  chInfo: { borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  chInfoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  chInfoTitle: { fontSize: 15, fontWeight: '800', color: C.ink },
  chInfoBody: { fontSize: 14, lineHeight: 20, color: C.sub, marginTop: 2 },
  chAddress: { fontSize: 12, color: C.faint, textAlign: 'center', marginTop: 18, lineHeight: 17 },
  helloRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 12 },
  helloSmall: { flex: 1, fontSize: 19, fontFamily: F.display, color: C.ink, letterSpacing: -0.3 },
  todaySmall: { fontSize: 13, fontWeight: '700', color: C.faint },
  carousel: { borderRadius: 28, overflow: 'hidden' },
  heroTopRow: { position: 'absolute', left: 18, right: 18, top: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  upNext: { paddingHorizontal: 11, height: 26, borderRadius: 13, backgroundColor: C.orange, justifyContent: 'center' },
  upNextText: { fontSize: 12, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase', color: '#FFFFFF' },
  carDots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  carDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.line },
  carDotOn: { width: 18, backgroundColor: C.orange },
  notApplicable: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, opacity: 0.6 },
  naIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  naPill: { paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: C.bg, justifyContent: 'center' },
  naText: { fontSize: 12, fontWeight: '800', color: C.sub },
  todayLine: { fontSize: 14, fontWeight: '700', color: C.sub, marginTop: -10, marginBottom: 18 },
  homeSection: { fontSize: 20, fontFamily: F.display, color: C.ink, letterSpacing: -0.3, marginTop: 32, marginBottom: 12 },
  homeHeadRow: { flexDirection: 'row', alignItems: 'center', marginTop: 32, marginBottom: 12 },
  latest: { borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  latestRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  latestDot: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.bluePale, alignItems: 'center', justifyContent: 'center' },
  food: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 22, backgroundColor: '#FDF0E3', borderWidth: 1, borderColor: '#F4D2AE' },
  foodIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  foodEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: '#9A5A16' },
  foodTitle: { fontSize: 17, fontWeight: '800', color: '#3B2412', marginTop: 2 },
  appleCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingRight: 30, borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, marginBottom: 16 },
  appleBadge: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.inverse, alignItems: 'center', justifyContent: 'center' },
  appleGlyph: { color: C.onInverse, fontSize: 20, marginTop: -2 },
  appleBtn: { paddingHorizontal: 16, height: 36, borderRadius: 18, backgroundColor: C.inverse, justifyContent: 'center' },
  appleBtnText: { color: C.onInverse, fontSize: 14, fontWeight: '800' },
  appleX: { position: 'absolute', top: 8, right: 8, padding: 4 },
  rsvp: { padding: 16, borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  rsvpHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  goingPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 28, borderRadius: 14, backgroundColor: C.bluePale },
  goingPillText: { fontSize: 13, fontWeight: '800', color: C.blueDeep },
  rsvpRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  rsvpBtn: { flex: 1, height: 50, borderRadius: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line },
  rsvpYes: { backgroundColor: C.green, borderColor: C.green },
  rsvpNo: { backgroundColor: C.inverse, borderColor: C.inverse },
  rsvpText: { fontSize: 16, fontWeight: '800', color: C.ink },
  rsvpNote: { fontSize: 13, color: C.sub, marginTop: 12, lineHeight: 18 },
  goingNames: { fontSize: 14, fontWeight: '700', color: C.ink, marginTop: 12 },
  helloLine: { fontSize: 27, lineHeight: 32, fontFamily: F.display, color: C.ink, letterSpacing: -0.6, marginBottom: 14, marginTop: -2 },
  hello: { fontSize: 32, lineHeight: 37, fontFamily: F.display, color: C.ink, letterSpacing: -0.6 },
  helloSub: { fontSize: 16, lineHeight: 22, color: C.sub, marginTop: 6 },
  section: { fontSize: 20, fontFamily: F.display, color: C.ink, letterSpacing: -0.2, marginTop: 38, marginBottom: 14 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  hero: { marginTop: 0, borderRadius: 28, overflow: 'hidden', minHeight: 280, justifyContent: 'flex-end', padding: 20, backgroundColor: C.blueDeep },
  heroKicker: { color: 'rgba(255,255,255,0.92)', fontSize: 13, fontWeight: '800' },
  heroTitle: { color: C.white, fontSize: 28, lineHeight: 32, fontFamily: F.display, letterSpacing: -0.4, marginTop: 4 },
  heroDate: { color: C.white, fontSize: 14, fontWeight: '700', marginTop: 6 },
  heroBtn: { marginTop: 16, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.white, borderRadius: R.pill, paddingHorizontal: 18, height: 42 },
  heroBtnText: { color: C.night, fontSize: 15, fontWeight: '800' },
  notify: { marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  quickRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  quick: { width: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 14 },
  quickLabel: { flex: 1, fontSize: 16, fontWeight: '800', color: C.ink },
  shabbat: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  shabbatTimes: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 8 },
  timeBig: { fontSize: 20, fontFamily: F.display, color: C.ink, letterSpacing: -0.3 },
  timeRule: { width: 1, height: 30, backgroundColor: C.line },
  endNote: { textAlign: 'center', color: C.faint, fontSize: 13, marginTop: 14, lineHeight: 19 },
  sheetImgWrap: { aspectRatio: 16 / 9, backgroundColor: C.line, justifyContent: 'flex-end' },
  sheetTitle: { position: 'absolute', left: 18, right: 18, bottom: 16, color: C.white, fontSize: 26, lineHeight: 30, fontFamily: F.display, letterSpacing: -0.3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 16 },
  rule: { borderTopWidth: 1, borderTopColor: C.line },
  inBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.greenPale, borderRadius: 18, padding: 16 },
  intlNote: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.line },
  err: { color: '#C0303F', fontWeight: '700', fontSize: 13, marginTop: 8, textAlign: 'center' },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, paddingBottom: 12 },
  pinned: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.bluePale, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 5 },
  pinnedText: { color: C.blueDeep, fontSize: 12, fontWeight: '800' },
  attach: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 14, padding: 10, borderRadius: R.tile, backgroundColor: C.bg },
  attachImg: { width: 56, height: 56, borderRadius: 14 },
  photo: { width: 150, height: 150, borderRadius: R.tile, backgroundColor: C.line },
  photoBig: { width: 300, height: 380, borderRadius: 20, backgroundColor: C.line },
  postFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, marginTop: 14, borderTopWidth: 1, borderTopColor: C.line },
  like: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  likeText: { fontSize: 14, fontWeight: '700', color: C.sub },
  about: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  aboutLogo: { width: 44, height: 72 },
  meAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  meInitial: { color: C.white, fontSize: 18, fontFamily: F.display },
  askRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  leaderLink: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'center', marginTop: 28, paddingHorizontal: 16, paddingVertical: 10, borderRadius: R.pill, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  leaderText: { fontSize: 14, fontWeight: '700', color: C.ink },
});
