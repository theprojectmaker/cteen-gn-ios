import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { C, HUES, R, T } from './theme';
import { Icon } from './icons';
import { doneThisPeriod, hourLabel, periodKey, streak, useStore, type Challenge, type WallPost } from './store';
import { Button, Card, Chips, Field, IconTile, s as u } from './ui';
import { snapPhoto } from './photo';

const doneLabel = (ch: Challenge) => (ch.every === 'day' ? 'Done for today' : 'Done this week');
const unit = (ch: Challenge, n: number) => (ch.every === 'day' ? `day${n === 1 ? '' : 's'}` : `week${n === 1 ? '' : 's'}`);

function Bar({ ch, count, height = 8 }: { ch: Challenge; count: number; height?: number }) {
  const hue = HUES[ch.color] ?? HUES.blue;
  return (
    <View style={[st.track, { height, borderRadius: height / 2, backgroundColor: hue.pale }]}>
      <View style={[st.fillBar, { borderRadius: height / 2, width: `${Math.min(100, (count / ch.goal) * 100)}%`, backgroundColor: hue.solid }]} />
    </View>
  );
}

// Home card for a live challenge: one clear line and one clear button.
export function ChallengeBanner({ ch }: { ch: Challenge }) {
  const { checks, joined, openChallenge } = useStore();
  const hue = HUES[ch.color] ?? HUES.blue;
  const mine = joined.includes(ch.id);
  const done = doneThisPeriod(ch, checks);
  const fire = streak(ch, checks);
  const line = !mine ? 'Tap to join. Rewards to win.' : done ? `${fire} ${unit(ch, fire)} in a row. See you tomorrow.` : fire > 0 ? `${fire} ${unit(ch, fire)} in a row. Keep it alive.` : 'Start your streak today.';
  const action = !mine ? 'Join' : done ? 'Done' : ch.photo ? 'Snap' : 'Check in';
  return (
    <Card style={st.banner} onPress={() => openChallenge(ch.id)} label={`${ch.title}. ${line}`}>
      <IconTile icon={ch.icon || 'trophy'} color={ch.color} size={52} solid />
      <View style={{ flex: 1 }}>
        <Text style={T.h3} numberOfLines={1}>{ch.title}</Text>
        <Text style={[T.small, { marginTop: 2 }]} numberOfLines={2}>{line}</Text>
      </View>
      <View style={[st.pill, { backgroundColor: done ? hue.pale : hue.solid }]}>
        {done ? <Icon name="tick" size={14} color={hue.deep} stroke={2.8} /> : ch.photo && mine ? <Icon name="camera" size={14} color={C.white} stroke={2.4} /> : null}
        <Text style={[st.pillText, done && { color: hue.deep }]}>{action}</Text>
      </View>
    </Card>
  );
}

export function NameGate({ onDone, title, cta = 'Save' }: { onDone: () => void; title: string; cta?: string }) {
  const { name, grade, setProfile } = useStore();
  const [n, setN] = useState(name);
  const [g, setG] = useState(grade);
  return (
    <View>
      <Text style={T.h2}>{title}</Text>
      <Text style={[T.small, { marginTop: 4 }]}>First name and last initial is perfect. Only the rabbi sees sign-up lists.</Text>
      <Field label="Your name" value={n} onChange={setN} placeholder="Like: Noah S." />
      <Text style={[u.fieldLabel, { marginTop: 14 }]}>Grade</Text>
      <View style={u.chipsFlow}>
        {['8', '9', '10', '11', '12'].map((x) => (
          <Pressable key={x} onPress={() => setG(x)} style={[u.chip, g === x && u.chipOn]} accessibilityRole="button" accessibilityState={{ selected: g === x }} accessibilityLabel={`Grade ${x}`}>
            <Text style={[u.chipText, g === x && u.chipTextOn]}>{x}th</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ marginTop: 18 }}>
        <Button label={cta} disabled={n.trim().length < 2} onPress={() => { setProfile(n, g); onDone(); }} />
      </View>
    </View>
  );
}

const REMINDERS = [
  { l: 'No reminder', h: null },
  { l: '7:00 AM', h: 7 },
  { l: '4:00 PM', h: 16 },
  { l: '8:00 PM', h: 20 },
] as const;

function ReminderPicker({ value, onChange, ch }: { value: number | null; onChange: (h: number | null) => void; ch: Challenge }) {
  const { push } = useStore();
  return (
    <View>
      <Text style={u.fieldLabel}>{ch.every === 'day' ? 'Remind me every day' : 'Remind me every Friday'}</Text>
      <Chips wrap options={REMINDERS.map((r) => r.l)} value={REMINDERS.find((r) => r.h === value)?.l ?? REMINDERS[0].l} onChange={(l) => onChange(REMINDERS.find((r) => r.l === l)!.h)} />
      {push === 'unsupported' ? <Text style={[T.small, { marginTop: 6, fontSize: 12 }]}>Reminders work in the app on your phone.</Text> : null}
      {push === 'blocked' ? <Text style={[T.small, { marginTop: 6, fontSize: 12 }]}>Notifications are off for CTeen GN in your phone's Settings.</Text> : null}
    </View>
  );
}

// The last 7 days (or weeks), oldest first: done, missed, Shabbat, or today.
function Week({ ch, light }: { ch: Challenge; light?: boolean }) {
  const { checks } = useStore();
  const hue = HUES[ch.color] ?? HUES.blue;
  const have = new Set(checks[ch.id] ?? []);
  const days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i) * (ch.every === 'week' ? 7 : 1));
    return { key: periodKey(ch.every, d), d };
  });
  return (
    <View style={st.week}>
      {days.map(({ key, d }, i) => {
        const on = have.has(key);
        const today = i === 6;
        const shabbat = ch.every === 'day' && d.getDay() === 6;
        return (
          <View key={key} style={st.weekCol}>
            <View style={[st.weekDot, on ? { backgroundColor: light ? C.white : hue.solid } : { borderWidth: 2, borderColor: light ? (today ? C.white : 'rgba(255,255,255,0.35)') : today ? hue.solid : C.line }]}>
              {on ? <Icon name="tick" size={14} color={light ? hue.deep : C.white} stroke={3} /> : null}
            </View>
            <Text style={[st.weekLabel, light && { color: 'rgba(255,255,255,0.85)' }, today && { color: light ? C.white : hue.deep }]}>{ch.every === 'week' ? `${d.getMonth() + 1}/${d.getDate()}` : shabbat ? 'Shab' : 'SMTWTFS'[d.getDay()]}</Text>
          </View>
        );
      })}
    </View>
  );
}

// Full page for one challenge (app/challenge/[id].tsx):
// sign up with your name, keep a streak with a daily photo, and see everyone's photos for the day.
export function ChallengePage({ ch }: { ch: Challenge }) {
  const { counts, checks, name, joined, reminders, join, leave, checkin, joinChallenge } = useStore();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [setupName, setSetupName] = useState(name);
  const [hour, setHour] = useState<number | null>(reminders[ch.id] ?? null);
  const [day, setDay] = useState(0); // 0 = today, 1 = yesterday...
  const [wallKey, setWallKey] = useState(0); // bump to reload the wall
  const hue = HUES[ch.color] ?? HUES.blue;
  const count = counts[ch.id] ?? 0;
  const mine = joined.includes(ch.id);
  const done = doneThisPeriod(ch, checks);
  const fire = streak(ch, checks);

  const doJoin = async () => {
    setBusy(true); setNote(null);
    const e = await joinChallenge(ch.id, setupName, hour);
    setBusy(false);
    if (e) setNote(e);
  };
  const doCheck = async () => {
    setNote(null);
    let base64: string | undefined;
    if (ch.photo) {
      const snap = await snapPhoto();
      if (!snap) return;
      if ('error' in snap) return setNote(snap.error);
      base64 = snap.base64;
    }
    setBusy(true);
    const r = await checkin(ch.id, base64);
    setBusy(false);
    if (r.error) return setNote(r.error);
    setNote(r.already ? 'You already checked in today.' : `Posted. ${fire + 1} ${unit(ch, fire + 1)} in a row.`);
    setDay(0);
    setWallKey((k) => k + 1);
  };

  return (
    <View style={{ paddingBottom: 20 }}>
      <View style={st.head}>
        <IconTile icon={ch.icon || 'trophy'} color={ch.color} size={64} solid />
        <Text style={st.title}>{ch.title}</Text>
        <Text style={[T.body, { textAlign: 'center', marginTop: 8, color: C.sub, maxWidth: 380 }]}>{ch.about}</Text>
      </View>

      {!mine ? (
        ch.active ? (
          <Card style={{ padding: 22 }}>
            <Text style={T.h2}>Sign up</Text>
            <Text style={[T.small, { marginTop: 4, fontSize: 14 }]}>Put in your name and you're in. {ch.photo ? 'Every day, snap a photo to keep your streak. Everyone in the challenge sees the day\'s photos.' : ''}</Text>
            <Field label="Your name" value={setupName} onChange={setSetupName} placeholder="Like: Noah S." />
            <View style={{ marginTop: 18 }}><ReminderPicker value={hour} onChange={setHour} ch={ch} /></View>
            <View style={{ marginTop: 22 }}>
              <Button label={busy ? 'Signing you up…' : 'Sign me up'} color={hue.solid} disabled={busy || setupName.trim().length < 2} onPress={doJoin} />
            </View>
            {note ? <Text style={st.note}>{note}</Text> : null}
          </Card>
        ) : <Text style={[T.body, { textAlign: 'center' }]}>This challenge has ended.</Text>
      ) : (
        <>
          <View style={[st.streak, { backgroundColor: hue.solid }]}>
            <View style={[u.blob, { backgroundColor: hue.deep, opacity: 0.25, right: -60, top: -80 }]} />
            <View style={st.streakTop}>
              <Icon name="flame" size={28} color={C.white} stroke={2} />
              <Text style={st.streakBig}>{fire}</Text>
              <Text style={st.streakLabel}>{unit(ch, fire)}{'\n'}in a row</Text>
            </View>
            <View style={st.weekOnBlue}><Week ch={ch} light /></View>
          </View>

          {ch.active ? (
            <View style={{ marginTop: 16 }}>
              <Button
                label={busy ? 'Posting…' : done ? doneLabel(ch) : ch.photo ? 'Snap my photo' : 'Check in'}
                icon={done ? 'tick' : ch.photo ? 'camera' : undefined}
                color={hue.solid}
                disabled={busy || done}
                onPress={doCheck}
              />
            </View>
          ) : null}
          {note ? <Text style={st.note} accessibilityLiveRegion="polite">{note}</Text> : null}

          {ch.photo ? <Wall ch={ch} day={day} setDay={setDay} reloadKey={wallKey} /> : null}

          <View style={st.progressRow}>
            <Text style={T.h3}>{count} of {ch.goal} check-ins</Text>
            <Text style={T.small}>{(ch.rewards.find((r) => r.at > count)?.at ?? count) - count > 0 ? `${(ch.rewards.find((r) => r.at > count)?.at ?? 0) - count} to the next reward` : 'All rewards unlocked'}</Text>
          </View>
          <Bar ch={ch} count={count} height={10} />
          <Rewards ch={ch} count={count} mine={mine} />

          <View style={{ marginTop: 30 }}>
            <ReminderPicker value={hour} ch={ch} onChange={(h) => { setHour(h); join(ch.id, h); setNote(h === null ? 'Reminder turned off.' : `Reminder set for ${hourLabel(h)}.`); }} />
          </View>
          <Pressable onPress={() => leave(ch.id)} hitSlop={8} style={{ alignSelf: 'center', marginTop: 24 }} accessibilityRole="button">
            <Text style={[T.small, { textDecorationLine: 'underline' }]}>Leave this challenge</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

function Rewards({ ch, count, mine }: { ch: Challenge; count: number; mine: boolean }) {
  const hue = HUES[ch.color] ?? HUES.blue;
  if (!ch.rewards.length) return null;
  return (
    <>
      <Text style={st.section}>Rewards</Text>
      <Card style={{ padding: 0 }}>
        {ch.rewards.map((r, i) => {
          const got = mine && count >= r.at;
          return (
            <View key={r.at} style={[st.row, i > 0 && st.rule]}>
              <View style={[st.dot, { backgroundColor: got ? hue.solid : C.bg }]}>
                <Icon name={got ? 'gift' : 'lock'} size={16} color={got ? C.white : C.faint} stroke={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={T.h3}>{r.prize || 'Reward'}</Text>
                <Text style={T.small}>{got ? 'Unlocked. Show this to Rabbi Zevy.' : `At ${r.at} check-ins`}</Text>
              </View>
            </View>
          );
        })}
      </Card>
    </>
  );
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Shabbat'];
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const nyDay = (back: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(Date.now() - back * 86400000));

// The day's photo wall: everyone's photo, name and time, the rabbi's check, and comments.
function Wall({ ch, day, setDay, reloadKey }: { ch: Challenge; day: number; setDay: (d: number) => void; reloadKey: number }) {
  const { fetchWall } = useStore();
  const [posts, setPosts] = useState<WallPost[] | null>(null);
  const [members, setMembers] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setPosts(null); setErr(null);
    fetchWall(ch.id, nyDay(day)).then((r) => {
      if (!alive) return;
      if ('error' in r) return setErr(r.error);
      setPosts(r.posts); setMembers(r.members);
    });
    return () => { alive = false; };
  }, [ch.id, day, reloadKey]);
  const labels = [...Array(7)].map((_, i) => (i === 0 ? 'Today' : i === 1 ? 'Yesterday' : DAY_NAMES[new Date(Date.now() - i * 86400000).getDay()]));
  return (
    <View style={{ marginTop: 30 }}>
      <View style={st.wallHead}>
        <Text style={st.section0}>{day === 0 ? "Today's photos" : `${labels[day]}'s photos`}</Text>
        <Text style={T.small}>{members} in the challenge</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingVertical: 4 }}>
        {labels.map((l, i) => (
          <Pressable key={l + i} onPress={() => setDay(i)} style={[u.chip, i === day && u.chipOn]} accessibilityRole="button" accessibilityState={{ selected: i === day }}>
            <Text style={[u.chipText, i === day && u.chipTextOn]}>{l}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={{ gap: 16, marginTop: 14 }}>
        {err ? <Text style={T.small}>{err}</Text> : posts === null ? <Text style={T.small}>Loading photos…</Text> : posts.length === 0 ? (
          <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
            <Icon name="camera" size={28} color={C.faint} />
            <Text style={[T.h3, { marginTop: 8 }]}>{day === 0 ? 'No photos yet today' : 'No photos that day'}</Text>
            <Text style={T.small}>{day === 0 ? 'Be the first one up.' : ''}</Text>
          </Card>
        ) : posts.map((p) => <WallCard key={p.key} ch={ch} post={p} />)}
      </View>
    </View>
  );
}

function WallCard({ ch, post }: { ch: Challenge; post: WallPost }) {
  const { comment } = useStore();
  const [comments, setComments] = useState(post.comments);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true); setErr(null);
    const r = await comment(ch.id, post.key, text.trim());
    setBusy(false);
    if ('error' in r) return setErr(r.error);
    setComments((c) => [...c, r]);
    setText('');
  };
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <View style={st.postHead}>
        <View style={st.avatar}><Text style={st.avatarText}>{post.name[0]?.toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={T.h3}>{post.name}{post.mine ? ' (you)' : ''}</Text>
          <Text style={T.small}>Posted at {timeOf(post.at)}</Text>
        </View>
        {post.status === 'checked' ? (
          <View style={st.checked}><Icon name="check" size={14} color={C.green} stroke={2.4} /><Text style={st.checkedText}>Checked</Text></View>
        ) : null}
      </View>
      <Image source={{ uri: post.url }} style={st.wallPhoto} resizeMode="cover" accessibilityLabel={`${post.name}'s photo`} />
      <View style={{ padding: 14, gap: 8 }}>
        {comments.map((c, i) => (
          <Text key={c.at + i} style={st.comment}>
            <Text style={[st.commentName, c.leader && { color: C.blueDeep }]}>{c.leader ? 'Rabbi Zevy' : c.name} </Text>
            {c.text}
          </Text>
        ))}
        <View style={st.commentRow}>
          <TextInput value={text} onChangeText={setText} placeholder="Add a comment" placeholderTextColor={C.faint} style={st.commentInput} maxLength={200} accessibilityLabel={`Comment on ${post.name}'s photo`} onSubmitEditing={send} returnKeyType="send" />
          <Pressable onPress={send} disabled={busy || !text.trim()} style={[st.send, (!text.trim() || busy) && { opacity: 0.4 }]} accessibilityRole="button" accessibilityLabel="Send comment">
            <Icon name="send" size={18} color={C.white} stroke={2.2} />
          </Pressable>
        </View>
        {err ? <Text style={[T.small, { color: '#C0303F' }]}>{err}</Text> : null}
      </View>
    </Card>
  );
}

const st = StyleSheet.create({
  streakTop: { flexDirection: 'row', alignItems: 'center', gap: 12, justifyContent: 'center' },
  weekOnBlue: { marginTop: 18, paddingHorizontal: 14 },
  wallHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
  section0: { fontSize: 20, fontWeight: '900', color: C.ink },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.bluePale, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '900', color: C.blueDeep },
  checked: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.greenPale, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 5 },
  checkedText: { fontSize: 12, fontWeight: '800', color: C.green },
  wallPhoto: { width: '100%', aspectRatio: 4 / 5, backgroundColor: C.line },
  comment: { fontSize: 14, lineHeight: 20, color: C.ink },
  commentName: { fontWeight: '800' },
  commentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  commentInput: { flex: 1, minHeight: 42, borderRadius: R.pill, backgroundColor: C.bg, paddingHorizontal: 16, fontSize: 15, color: C.ink },
  send: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  track: { overflow: 'hidden' },
  fillBar: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: R.pill, paddingHorizontal: 16, minHeight: 38, justifyContent: 'center' },
  pillText: { color: C.white, fontSize: 14, fontWeight: '800' },
  head: { alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 26 },
  title: { fontSize: 30, lineHeight: 34, fontWeight: '900', color: C.ink, letterSpacing: -0.5, textAlign: 'center', marginTop: 4 },
  streak: { borderRadius: 26, paddingVertical: 22, overflow: 'hidden' },
  streakBig: { color: C.white, fontSize: 56, lineHeight: 62, fontWeight: '900', letterSpacing: -2 },
  streakLabel: { color: C.white, fontSize: 15, lineHeight: 19, fontWeight: '800' },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  weekCol: { alignItems: 'center', gap: 6 },
  weekDot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  weekLabel: { fontSize: 11, fontWeight: '800', color: C.sub },
  photo: { width: 140, height: 140, borderRadius: 18, alignSelf: 'center', marginTop: 14, backgroundColor: C.line },
  note: { fontSize: 14, color: C.ink, fontWeight: '700', marginTop: 12, textAlign: 'center' },
  progressRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 28, marginBottom: 10 },
  section: { fontSize: 19, fontWeight: '900', color: C.ink, marginTop: 34, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  rule: { borderTopWidth: 1, borderTopColor: C.line },
  dot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  rank: { fontSize: 14, fontWeight: '900', color: C.sub },
});
