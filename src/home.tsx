import React, { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C, R, T, F } from './theme';
import { Icon } from './icons';
import { challengeFits, countdown, dateLabel, daysUntil, sortPosts, upcoming, useShabbat, useStore, type ColorKey, type EventItem } from './store';
import { Card, Cover, IconTile, ScopeBadge, s as u } from './ui';
import { ChallengeBanner } from './rewards';
import { timeAgo } from './feed';
import { InviteCards } from './invites';
import { MINYAN_FALLBACK, minyanTime } from './minyan';
import { greetingNow } from './shell';

const WKD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const parseDay = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

// ───────────────────────── Home ─────────────────────────
// One thing per section, lots of room: who you are, what's next, your challenge,
// the newest post, Shabbat, then the shortcuts at the bottom.
export function Home() {
  const { content, go, openEvent, name, push, turnOnPush, fits, gender, postMeta } = useStore();
  // The 3 soonest upcoming events, in date order (upcoming() already sorts by start date).
  const up = upcoming(content.events).filter(fits);
  const coming = [...up].sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0)).slice(0, 3); // featured first, then soonest
  const thisWeek = up.filter((e) => daysUntil(e.start) >= 0 && daysUntil(e.start) <= 6).slice(0, 6);
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

      {thisWeek.length ? (
        <>
          <Text style={st.homeSection}>This week</Text>
          <View style={st.weekList}>
            {thisWeek.map((e, i) => {
              const d = daysUntil(e.start);
              const isToday = d === 0;
              const dt = parseDay(e.start);
              return (
                <Pressable key={e.id} onPress={() => openEvent(e.id)} style={({ pressed }) => [st.weekRow, i > 0 && st.weekRule, isToday && st.weekRowToday, pressed && { backgroundColor: C.bg }]} accessibilityRole="button" accessibilityLabel={`${e.title}, ${isToday ? 'today' : countdown(e)}`}>
                  <View style={[st.weekDay, isToday && { backgroundColor: C.orange }]}>
                    <Text style={[st.weekDow, isToday && { color: 'rgba(255,255,255,0.9)' }]}>{WKD[dt.getDay()]}</Text>
                    <Text style={[st.weekNum, isToday && { color: C.white }]}>{dt.getDate()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={T.h3} numberOfLines={1}>{e.title}</Text>
                    <Text style={T.small} numberOfLines={1}>{isToday ? 'Today' : d === 1 ? 'Tomorrow' : countdown(e)}{e.time ? ` · ${e.time}` : ''}{e.repeat === 'weekly' ? ' · Weekly' : ''}</Text>
                  </View>
                  {isToday ? <View style={st.todayPill}><Text style={st.todayPillText}>Today</Text></View> : <Icon name="right" size={16} color={C.faint} stroke={2.4} />}
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

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
            {posts.slice(0, 3).map((p, i) => (
              <Pressable key={p.id} onPress={() => router.push(`/post/${p.id}`)} style={({ pressed }) => [st.latestRow, i > 0 && st.rule, pressed && { backgroundColor: C.bg }]} accessibilityRole="button" accessibilityLabel={p.title}>
                {p.photos?.[0] ? <Image source={{ uri: p.photos[0] }} style={st.latestThumb} resizeMode="cover" /> : null}
                <View style={{ flex: 1 }}>
                  <Text style={T.h3} numberOfLines={2}>{p.title}</Text>
                  {p.body ? <Text style={[T.small, { marginTop: 2 }]} numberOfLines={2}>{p.body}</Text> : null}
                  <Text style={st.latestMeta} numberOfLines={1}>{p.pinned ? 'Pinned · ' : ''}{p.kind} · {timeAgo(p.at)}{postMeta?.[p.id]?.comments ? ` · ${postMeta[p.id].comments} ${postMeta[p.id].comments === 1 ? 'comment' : 'comments'}` : ''}</Text>
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
  const { content } = useStore();
  if (sh === 'error') return null;
  const teen = (content.minyan?.shabbat ?? MINYAN_FALLBACK.shabbat).find((r) => /teen/i.test(r.label));
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
        {teen ? (
          <View style={st.shabbatExtra}>
            <Text style={st.shabbatExtraLabel} numberOfLines={1}>{teen.label} · Saturday</Text>
            <Text style={st.shabbatExtraTime}>{minyanTime(teen.time, sh || null).time}</Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

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
        {events.map((ev, i) => {
          const poster = !!(ev.fullPoster && ev.cover);
          if (poster) {
            // A full poster speaks for itself: show it whole (no crop), no text over it.
            return (
              <Pressable key={ev.id} onPress={() => onOpen(ev.id)} style={({ pressed }) => [st.hero, st.heroPoster, { width: w || 1 }, pressed && { opacity: 0.95 }]} accessibilityRole="button" accessibilityLabel={ev.title}>
                <Image source={{ uri: ev.cover }} style={StyleSheet.absoluteFill} resizeMode="contain" />
              </Pressable>
            );
          }
          return (
            <Pressable key={ev.id} onPress={() => onOpen(ev.id)} style={({ pressed }) => [st.hero, { width: w || 1 }, pressed && { opacity: 0.95 }]} accessibilityRole="button" accessibilityLabel={ev.title}>
              <Cover e={ev} style={StyleSheet.absoluteFill} iconSize={150} />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: ev.image || ev.cover ? 'rgba(13,60,110,0.42)' : 'rgba(19,32,44,0.18)' }]} />
              <View style={st.heroTopRow}>
                <View style={st.upNext}><Text style={st.upNextText}>{ev.priority ? 'Featured' : i === 0 ? 'Up next' : 'Coming up'}</Text></View>
                <ScopeBadge scope={ev.scope} />
              </View>
              <Text style={st.heroKicker}>{countdown(ev)}</Text>
              <Text style={st.heroTitle} numberOfLines={2}>{ev.title}</Text>
              <Text style={st.heroDate}>{dateLabel(ev)}{ev.time ? ` · ${ev.time}` : ''}</Text>
              {ev.place || ev.price ? <Text style={st.heroWhere} numberOfLines={1}>{[ev.place, ev.price].filter(Boolean).join(' · ')}</Text> : null}
              <View style={st.heroBtn}>
                <Text style={st.heroBtnText}>{ev.signup === 'app' ? 'RSVP' : 'View details'}</Text>
                <Icon name="right" size={15} color={C.night} stroke={2.4} />
              </View>
            </Pressable>
          );
        })}
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

const st = StyleSheet.create({
  helloRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 12 },
  helloSmall: { flex: 1, fontSize: 19, fontFamily: F.display, color: C.ink, letterSpacing: -0.3 },
  todaySmall: { fontSize: 13, fontWeight: '700', color: C.faint },
  food: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 22, backgroundColor: '#FDF0E3', borderWidth: 1, borderColor: '#F4D2AE' },
  foodIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  foodEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: '#9A5A16' },
  foodTitle: { fontSize: 17, fontWeight: '800', color: '#3B2412', marginTop: 2 },
  homeSection: { fontSize: 20, fontFamily: F.display, color: C.ink, letterSpacing: -0.3, marginTop: 32, marginBottom: 12 },
  weekList: { borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, paddingVertical: 12 },
  weekRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  weekRowToday: { backgroundColor: C.orangePale },
  weekDay: { width: 46, height: 48, borderRadius: 14, backgroundColor: C.bluePale, alignItems: 'center', justifyContent: 'center' },
  weekDow: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, color: C.blueDeep, textTransform: 'uppercase' },
  weekNum: { fontSize: 20, fontFamily: F.display, color: C.ink, marginTop: -1 },
  todayPill: { backgroundColor: C.orange, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 4 },
  todayPillText: { color: C.white, fontSize: 12, fontWeight: '800' },
  homeHeadRow: { flexDirection: 'row', alignItems: 'center', marginTop: 32, marginBottom: 12 },
  latest: { borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  latestRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  rule: { borderTopWidth: 1, borderTopColor: C.line },
  latestThumb: { width: 52, height: 52, borderRadius: 12, backgroundColor: C.line },
  latestMeta: { fontSize: 12, fontWeight: '600', color: C.faint, marginTop: 4 },
  quick: { width: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 14 },
  quickLabel: { flex: 1, fontSize: 16, fontWeight: '800', color: C.ink },
  shabbat: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  shabbatTimes: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 8 },
  timeBig: { fontSize: 20, fontFamily: F.display, color: C.ink, letterSpacing: -0.3 },
  timeRule: { width: 1, height: 30, backgroundColor: C.line },
  shabbatExtra: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  shabbatExtraLabel: { fontSize: 14, fontWeight: '600', color: C.sub, flex: 1 },
  shabbatExtraTime: { fontSize: 15, fontWeight: '800', color: C.ink },
  carousel: { borderRadius: 28, overflow: 'hidden' },
  hero: { marginTop: 0, borderRadius: 28, overflow: 'hidden', minHeight: 280, justifyContent: 'flex-end', padding: 20, backgroundColor: C.blueDeep },
  heroPoster: { padding: 0, backgroundColor: '#0B1520' },
  heroTopRow: { position: 'absolute', left: 18, right: 18, top: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  upNext: { paddingHorizontal: 11, height: 26, borderRadius: 13, backgroundColor: C.orange, justifyContent: 'center' },
  upNextText: { fontSize: 12, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase', color: '#FFFFFF' },
  heroKicker: { color: 'rgba(255,255,255,0.92)', fontSize: 13, fontWeight: '800' },
  heroTitle: { color: C.white, fontSize: 28, lineHeight: 32, fontFamily: F.display, letterSpacing: -0.4, marginTop: 4 },
  heroDate: { color: C.white, fontSize: 14, fontWeight: '700', marginTop: 6 },
  heroWhere: { color: 'rgba(255,255,255,0.88)', fontSize: 13, fontWeight: '600', marginTop: 3 },
  heroBtn: { marginTop: 16, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.white, borderRadius: R.pill, paddingHorizontal: 18, height: 42 },
  heroBtnText: { color: C.night, fontSize: 15, fontWeight: '800' },
  carDots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  carDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.line },
  carDotOn: { width: 18, backgroundColor: C.orange },
  appleCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingRight: 30, borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, marginBottom: 16 },
  appleBadge: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.inverse, alignItems: 'center', justifyContent: 'center' },
  appleGlyph: { color: C.onInverse, fontSize: 20, marginTop: -2 },
  appleBtn: { paddingHorizontal: 16, height: 36, borderRadius: 18, backgroundColor: C.inverse, justifyContent: 'center' },
  appleBtnText: { color: C.onInverse, fontSize: 14, fontWeight: '800' },
  appleX: { position: 'absolute', top: 8, right: 8, padding: 4 },
});
