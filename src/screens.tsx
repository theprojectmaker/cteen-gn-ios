import React, { useCallback, useEffect, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C, R, T } from './theme';
import { Icon } from './icons';
import { CHAPTER, calendarUrl, countdown, dateLabel, open, upcoming, useShabbat, useStore, type ColorKey, type EventItem, type Post } from './store';
import { audienceLabel, Button, Card, Chips, Cover, Empty, EventCard, EventMeta, Field, IconTile, ScopeBadge, SectionHead, Sheet, s as u } from './ui';
import { ChallengeBanner, NameGate } from './rewards';

// ───────────────────────── Home ─────────────────────────
// One thing per section, lots of room: who you are, what's next, your challenge,
// the newest post, Shabbat, then the shortcuts at the bottom.
export function Home() {
  const { content, go, openEvent, name, push, turnOnPush, fits } = useStore();
  const up = upcoming(content.events).filter(fits);
  const next = up.find((e) => e.scope === 'gn') ?? up[0];
  const live = content.challenges.filter((c) => c.active);
  const latest = sortPosts(content.posts)[0];
  const first = name.split(' ')[0];
  const h = new Date().getHours();
  const hello = h < 12 ? 'Good morning' : h < 18 ? 'Hey' : 'Good evening';
  return (
    <>
      <Text style={st.hello}>{hello}{first ? `, ${first}` : ''}</Text>
      <Text style={st.helloSub}>Here's what's happening at CTeen Great Neck.</Text>

      {next ? (
        <Pressable onPress={() => openEvent(next.id)} style={({ pressed }) => [st.hero, pressed && u.pressed]} accessibilityRole="button" accessibilityLabel={next.title}>
          <Cover e={next} style={u.fill} iconSize={150} />
          <View style={[u.fill, { backgroundColor: next.image ? 'rgba(13,60,110,0.5)' : 'rgba(19,32,44,0.18)' }]} />
          <ScopeBadge scope={next.scope} style={{ position: 'absolute', left: 18, top: 18 }} />
          <Text style={st.heroKicker}>Up next · {countdown(next)}</Text>
          <Text style={st.heroTitle}>{next.title}</Text>
          <Text style={st.heroDate}>{dateLabel(next)}{next.time ? ` · ${next.time}` : ''}</Text>
          <View style={st.heroBtn}>
            <Text style={st.heroBtnText}>{next.signup === 'app' ? 'Sign up' : 'View details'}</Text>
            <Icon name="right" size={15} color={C.ink} stroke={2.4} />
          </View>
        </Pressable>
      ) : null}

      {live.length ? (
        <>
          <Text style={st.section}>{live.length === 1 ? 'Your challenge' : 'Your challenges'}</Text>
          <View style={{ gap: 12 }}>
            {live.map((c) => <ChallengeBanner key={c.id} ch={c} />)}
          </View>
        </>
      ) : null}

      {latest ? (
        <>
          <SectionHead title="New from Rabbi Zevy" action="Feed" onAction={() => go('Feed')} />
          <PostCard post={latest} />
        </>
      ) : null}

      <Text style={st.section}>This Shabbat</Text>
      <ShabbatCard />

      {push === 'off' ? (
        <Card style={st.notify} onPress={turnOnPush} label="Turn on notifications">
          <IconTile icon="bell" size={44} />
          <View style={{ flex: 1 }}>
            <Text style={T.h3}>Turn on notifications</Text>
            <Text style={T.small}>Hear it first when Rabbi Zevy posts or an event opens.</Text>
          </View>
          <Icon name="right" size={17} color={C.faint} stroke={2.4} />
        </Card>
      ) : null}

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
const EVENT_FILTERS = ['All', 'Great Neck', 'International', 'Saved'] as const;

export function Events() {
  const { saved, content, fits } = useStore();
  const [f, setF] = useState<(typeof EVENT_FILTERS)[number]>('All');
  const list = upcoming(content.events).filter(fits).filter((e) => (f === 'All' ? true : f === 'Saved' ? saved.includes(e.id) : f === 'Great Neck' ? e.scope === 'gn' : e.scope === 'intl'));
  return (
    <>
      <Text style={T.eyebrow}>Events</Text>
      <Text style={[T.h1, { marginTop: 6, marginBottom: 14 }]}>What's on</Text>
      <Chips options={EVENT_FILTERS} value={f} onChange={setF} />
      <View style={{ gap: 26, marginTop: 18 }}>
        {list.map((e) => <EventCard key={e.id} e={e} />)}
      </View>
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
          <Button kind="ghost" icon="calendar" label="Add to calendar" onPress={() => open(calendarUrl(e))} />
        </View>
      </View>
    </>
  );
}

// Great Neck events: sign up right here, the rabbi sees the list.
function InAppSignup({ e }: { e: EventItem }) {
  const { going, name, grade, signup } = useStore();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const mine = going.includes(e.id);
  const run = async (on: boolean) => {
    setBusy(true); setErr(null);
    setErr(await signup(e.id, on));
    setBusy(false);
  };
  useEffect(() => { setAsk(false); setErr(null); }, [e.id]);
  if (ask) return <Card><NameGate title="Who's signing up?" cta="Sign me up" onDone={() => { setAsk(false); run(true); }} /></Card>;
  return (
    <View>
      {mine ? (
        <View style={st.inBox}>
          <Icon name="check" size={30} color={C.green} stroke={2} />
          <View style={{ flex: 1 }}>
            <Text style={T.h2}>You're in{name ? `, ${name.split(' ')[0]}` : ''}</Text>
            <Text style={T.small}>Rabbi Zevy has you on the list{grade ? ` (grade ${grade})` : ''}.</Text>
          </View>
        </View>
      ) : (
        <Button label={busy ? 'Signing you up…' : 'Sign me up'} disabled={busy} onPress={() => (name ? run(true) : setAsk(true))} />
      )}
      {err ? <Text style={st.err} accessibilityLiveRegion="polite">{err}</Text> : null}
      {e.payUrl ? (
        <View style={{ marginTop: 10 }}>
          <Button kind="ghost" icon="ticket" label={mine ? 'Next: get your ticket' : 'Ticket info'} onPress={() => open(e.payUrl!)} />
        </View>
      ) : null}
      {mine ? (
        <Pressable onPress={() => run(false)} disabled={busy} hitSlop={8} style={{ alignSelf: 'center', marginTop: 12 }} accessibilityRole="button">
          <Text style={[T.small, { textDecorationLine: 'underline' }]}>Can't make it? Remove me</Text>
        </Pressable>
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
          <Button label="Register on the CTeen website" icon="external" color={C.ink} onPress={() => open(e.url!)} />
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
const FEED_FILTERS = ['All', 'News', 'Events', 'Photos', 'Rewards'] as const;
const sortPosts = (posts: Post[]) => [...posts].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.at.localeCompare(a.at));

export function Feed() {
  const { content, leader, setAdminOpen, markFeedSeen } = useStore();
  const [f, setF] = useState<(typeof FEED_FILTERS)[number]>('All');
  useFocusEffect(useCallback(() => { markFeedSeen(); }, [markFeedSeen]));
  const list = sortPosts(content.posts).filter((p) => f === 'All' || p.kind === f);
  return (
    <>
      <Text style={T.eyebrow}>Chapter feed</Text>
      <Text style={[T.h1, { marginTop: 6 }]}>The latest</Text>
      <Text style={[T.small, { marginTop: 6, marginBottom: 14 }]}>From Rabbi Zevy and the {CHAPTER.name} leaders.</Text>
      {leader ? (
        <View style={{ marginBottom: 14 }}>
          <Button label="New post" icon="plus" onPress={() => setAdminOpen(true)} />
        </View>
      ) : null}
      <Chips options={FEED_FILTERS} value={f} onChange={setF} />
      <View style={{ gap: 14, marginTop: 18 }}>
        {list.map((p) => <PostCard key={p.id} post={p} />)}
      </View>
      {list.length === 0 ? <Empty icon="chat" title="Nothing here yet" body="Posts from the chapter show up here." /> : null}
    </>
  );
}

function PostCard({ post }: { post: Post }) {
  const { liked, toggleLiked, openEvent, openChallenge, content } = useStore();
  const on = liked.includes(post.id);
  const ev = post.eventId ? content.events.find((e) => e.id === post.eventId) : undefined;
  const ch = post.challengeId ? content.challenges.find((c) => c.id === post.challengeId) : undefined;
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <View style={st.postHead}>
        <Image source={require('../assets/logo.png')} style={st.avatar} resizeMode="contain" />
        <View style={{ flex: 1 }}>
          <Text style={T.h3}>{CHAPTER.name}</Text>
          <Text style={T.small}>{post.kind}</Text>
        </View>
        {post.pinned ? (
          <View style={st.pinned}>
            <Icon name="pinned" size={12} color={C.blueDeep} stroke={2.2} />
            <Text style={st.pinnedText}>Pinned</Text>
          </View>
        ) : null}
      </View>
      <View style={{ paddingHorizontal: 16 }}>
        <Text style={[T.h2, { fontSize: 18, lineHeight: 23 }]}>{post.title}</Text>
        {post.body ? <Text style={[T.body, { marginTop: 6, color: '#34424F' }]}>{post.body}</Text> : null}
      </View>
      {ev ? (
        <Pressable onPress={() => openEvent(ev.id)} style={({ pressed }) => [st.attach, pressed && u.pressed]} accessibilityRole="button" accessibilityLabel={`Open ${ev.title}`}>
          <Cover e={ev} style={st.attachImg} iconSize={26} />
          <View style={{ flex: 1 }}>
            <Text style={T.h3} numberOfLines={1}>{ev.title}</Text>
            <EventMeta e={ev} />
          </View>
          <Icon name="right" size={18} color={C.faint} stroke={2.4} />
        </Pressable>
      ) : null}
      {ch ? (
        <Pressable onPress={() => openChallenge(ch.id)} style={({ pressed }) => [st.attach, pressed && u.pressed]} accessibilityRole="button" accessibilityLabel={`Open ${ch.title}`}>
          <Cover e={ch} style={st.attachImg} iconSize={26} />
          <View style={{ flex: 1 }}>
            <Text style={T.h3} numberOfLines={1}>{ch.title}</Text>
            <Text style={[u.meta, { color: C.sub }]}>{ch.active ? 'Live now' : 'Ended'}</Text>
          </View>
          <Icon name="right" size={18} color={C.faint} stroke={2.4} />
        </Pressable>
      ) : null}
      {post.photos?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {post.photos.map((uri) => <Image key={uri} source={{ uri }} style={st.photo} resizeMode="cover" />)}
        </ScrollView>
      ) : null}
      <View style={st.postFoot}>
        <Pressable onPress={() => toggleLiked(post.id)} style={st.like} hitSlop={8} accessibilityRole="button" accessibilityLabel={on ? 'Unlike' : 'Like'}>
          <Icon name="heart" size={19} color={on ? '#E0445C' : C.sub} fill={on ? '#E0445C' : 'none'} />
          <Text style={[st.likeText, on && { color: '#E0445C' }]}>{on ? 'Liked' : 'Like'}</Text>
        </Pressable>
        {post.linkUrl ? (
          <Pressable onPress={() => open(post.linkUrl!)} style={u.sectionAction} hitSlop={8} accessibilityRole="link">
            <Text style={u.link}>{post.linkLabel || 'Open link'}</Text>
            <Icon name="right" size={15} color={C.blue} stroke={2.4} />
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

// ───────────────────────── Chapter ─────────────────────────
export function Chapter() {
  const { content, name, grade, age, account, leader, setAdminOpen, online, push, turnOnPush } = useStore();
  return (
    <>
      <Text style={T.eyebrow}>Your chapter</Text>
      <Text style={[T.h1, { marginTop: 6 }]}>{CHAPTER.name}</Text>

      <Card style={st.about}>
        <Image source={require('../assets/logo.png')} style={st.aboutLogo} resizeMode="contain" />
        <View style={{ flex: 1 }}>
          <Text style={T.h3}>The home for Jewish teens in Great Neck</Text>
          <Text style={[T.small, { marginTop: 4 }]}>Led by {CHAPTER.leaders}. Make friends, do good, and be proud of who you are.</Text>
        </View>
      </Card>
      <View style={{ marginTop: 12 }}>
        <Button label="Join CTeen Great Neck" onPress={() => open(CHAPTER.join)} />
      </View>

      <SectionHead title="You" />
      {(
        <Card style={{ padding: 0 }}>
          <Pressable onPress={() => router.push('/account')} style={st.linkRow} accessibilityRole="button" accessibilityLabel="Your account">
            <View style={st.meAvatar}>
              {name ? <Text style={st.meInitial}>{name[0].toUpperCase()}</Text> : <Icon name="user" size={20} color={C.white} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={T.h3}>{name || 'Add your name'}</Text>
              <Text style={T.small}>{[grade ? `Grade ${grade}` : '', age ? `Age ${age}` : '', account?.google ? 'Linked with Google' : ''].filter(Boolean).join(' · ') || 'Set up your account'}</Text>
            </View>
            <Icon name="right" size={17} color={C.faint} stroke={2.4} />
          </Pressable>
          <Pressable onPress={push === 'off' ? turnOnPush : undefined} disabled={push !== 'off'} style={[st.linkRow, st.rule]} accessibilityRole="button" accessibilityLabel="Notifications">
            <IconTile icon="bell" size={40} />
            <View style={{ flex: 1 }}>
              <Text style={T.h3}>Notifications</Text>
              <Text style={T.small}>{push === 'on' ? 'On. You hear it when the chapter posts.' : push === 'off' ? 'Tap to turn on' : push === 'blocked' ? "Off in your phone's Settings" : 'Available in the app on your phone'}</Text>
            </View>
            {push === 'on' ? <Icon name="check" size={20} color={C.green} /> : null}
          </Pressable>
        </Card>
      )}

      <AskRabbi />

      <SectionHead title="Good to know" />
      <Card style={{ padding: 0 }}>
        {content.info.map((i, n) => (
          <View key={i.id} style={[st.infoRow, n > 0 && st.rule]}>
            <IconTile icon={i.icon || 'star'} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={T.h3}>{i.title}</Text>
              <Text style={[T.small, { marginTop: 3, fontSize: 14, lineHeight: 20 }]}>{i.body}</Text>
            </View>
          </View>
        ))}
      </Card>

      <SectionHead title="Get in touch" />
      <Card style={{ padding: 0 }}>
        <LinkRow icon="phone" title="Call" sub={CHAPTER.phone} url={'tel:' + CHAPTER.phone.replace(/\D/g, '')} first />
        <LinkRow icon="pin" title="Find us" sub={CHAPTER.address} url={'https://maps.apple.com/?q=' + encodeURIComponent(CHAPTER.address)} />
        <LinkRow icon="camera" title="Instagram" sub={CHAPTER.instagramHandle} url={CHAPTER.instagram} />
        <LinkRow icon="users" title="Facebook" sub="Chabad GN Teens" url={CHAPTER.facebook} />
        <LinkRow icon="globe" title="CTeen portal" sub="International events, orders and service hours" url={CHAPTER.portal} />
        <LinkRow icon="gift" title="Donate" sub={`Support ${CHAPTER.name}`} url={CHAPTER.donate} />
      </Card>

      <Pressable onPress={() => setAdminOpen(true)} style={st.leaderLink} hitSlop={8} accessibilityRole="button">
        <Icon name={leader ? 'edit' : 'lock'} size={15} color={C.ink} stroke={2.2} />
        <Text style={st.leaderText}>{leader ? 'Open leader panel' : 'Leader sign-in'}</Text>
      </Pressable>
      <Text style={st.endNote}>{CHAPTER.org} · Part of the CTeen network{online === false ? '\nOffline: showing the last saved info' : ''}</Text>
    </>
  );
}

function AskRabbi() {
  const { name, ask } = useStore();
  const [openForm, setOpenForm] = useState(false);
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
  return (
    <>
      <SectionHead title="Ask the rabbi" />
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
  hello: { fontSize: 32, lineHeight: 37, fontWeight: '900', color: C.ink, letterSpacing: -0.6 },
  helloSub: { fontSize: 16, lineHeight: 22, color: C.sub, marginTop: 6 },
  section: { fontSize: 20, fontWeight: '900', color: C.ink, letterSpacing: -0.2, marginTop: 38, marginBottom: 14 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  hero: { marginTop: 24, borderRadius: 28, overflow: 'hidden', minHeight: 280, justifyContent: 'flex-end', padding: 20, backgroundColor: C.blueDeep },
  heroKicker: { color: 'rgba(255,255,255,0.92)', fontSize: 13, fontWeight: '800' },
  heroTitle: { color: C.white, fontSize: 28, lineHeight: 32, fontWeight: '900', letterSpacing: -0.4, marginTop: 4 },
  heroDate: { color: C.white, fontSize: 14, fontWeight: '700', marginTop: 6 },
  heroBtn: { marginTop: 16, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.white, borderRadius: R.pill, paddingHorizontal: 18, height: 42 },
  heroBtnText: { color: C.ink, fontSize: 15, fontWeight: '800' },
  notify: { marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  quickRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  quick: { width: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 14 },
  quickLabel: { flex: 1, fontSize: 16, fontWeight: '800', color: C.ink },
  shabbat: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  shabbatTimes: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 8 },
  timeBig: { fontSize: 20, fontWeight: '900', color: C.ink, letterSpacing: -0.3 },
  timeRule: { width: 1, height: 30, backgroundColor: C.line },
  endNote: { textAlign: 'center', color: C.faint, fontSize: 13, marginTop: 14, lineHeight: 19 },
  sheetImgWrap: { aspectRatio: 16 / 9, backgroundColor: C.line, justifyContent: 'flex-end' },
  sheetTitle: { position: 'absolute', left: 18, right: 18, bottom: 16, color: C.white, fontSize: 26, lineHeight: 30, fontWeight: '900', letterSpacing: -0.3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 16 },
  rule: { borderTopWidth: 1, borderTopColor: C.line },
  inBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.greenPale, borderRadius: 18, padding: 16 },
  intlNote: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.line },
  err: { color: '#C0303F', fontWeight: '700', fontSize: 13, marginTop: 8, textAlign: 'center' },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, paddingBottom: 12 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.bluePale },
  pinned: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.bluePale, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 5 },
  pinnedText: { color: C.blueDeep, fontSize: 12, fontWeight: '800' },
  attach: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 14, padding: 10, borderRadius: R.tile, backgroundColor: C.bg },
  attachImg: { width: 56, height: 56, borderRadius: 14 },
  photo: { width: 150, height: 150, borderRadius: R.tile, backgroundColor: C.line },
  postFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, marginTop: 14, borderTopWidth: 1, borderTopColor: C.line },
  like: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  likeText: { fontSize: 14, fontWeight: '700', color: C.sub },
  about: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  aboutLogo: { width: 44, height: 72 },
  meAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  meInitial: { color: C.white, fontSize: 18, fontWeight: '900' },
  askRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  leaderLink: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'center', marginTop: 28, paddingHorizontal: 16, paddingVertical: 10, borderRadius: R.pill, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  leaderText: { fontSize: 14, fontWeight: '700', color: C.ink },
});
