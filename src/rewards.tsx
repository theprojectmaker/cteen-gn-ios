import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { C, HUES, R, T } from './theme';
import { Icon } from './icons';
import { doneThisPeriod, fetchBoard, hourLabel, periodKey, streak, useStore, type BoardRow, type Challenge } from './store';
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
function Week({ ch }: { ch: Challenge }) {
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
            <View style={[st.weekDot, on ? { backgroundColor: hue.solid } : { borderWidth: 2, borderColor: today ? hue.solid : C.line }]}>
              {on ? <Icon name="tick" size={14} color={C.white} stroke={3} /> : null}
            </View>
            <Text style={[st.weekLabel, today && { color: hue.deep }]}>{ch.every === 'week' ? `${d.getMonth() + 1}/${d.getDate()}` : shabbat ? 'Shab' : 'SMTWTFS'[d.getDay()]}</Text>
          </View>
        );
      })}
    </View>
  );
}

// Full page for one challenge (app/challenge/[id].tsx).
export function ChallengePage({ ch }: { ch: Challenge }) {
  const { counts, checks, name, grade, joined, reminders, join, leave, checkin, setProfile } = useStore();
  const [board, setBoard] = useState<BoardRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [setupName, setSetupName] = useState(name);
  const [hour, setHour] = useState<number | null>(reminders[ch.id] ?? null);
  useEffect(() => { fetchBoard(ch.id).then(setBoard).catch(() => setBoard([])); }, [ch.id]);
  const hue = HUES[ch.color] ?? HUES.blue;
  const count = counts[ch.id] ?? 0;
  const mine = joined.includes(ch.id);
  const done = doneThisPeriod(ch, checks);
  const fire = streak(ch, checks);
  const next = ch.rewards.find((r) => r.at > count);

  const doCheck = async () => {
    setNote(null);
    let base64: string | undefined;
    if (ch.photo) {
      const snap = await snapPhoto();
      if (!snap) return;
      if ('error' in snap) return setNote(snap.error);
      setPhoto(snap.uri);
      base64 = snap.base64;
    }
    setBusy(true);
    const r = await checkin(ch.id, base64);
    setBusy(false);
    if (r.error) return setNote(r.error);
    if (r.board) setBoard(r.board);
    setNote(r.already ? 'You already checked in. Come back next time.' : `Checked in. ${fire + 1} ${unit(ch, fire + 1)} in a row.`);
  };

  return (
    <View style={{ paddingBottom: 20 }}>
      <View style={st.head}>
        <IconTile icon={ch.icon || 'trophy'} color={ch.color} size={72} solid />
        <Text style={[T.eyebrow, { marginTop: 16, color: hue.deep }]}>{!ch.active ? 'Challenge ended' : ch.every === 'day' ? 'Daily challenge' : 'Weekly challenge'}</Text>
        <Text style={st.title}>{ch.title}</Text>
        <Text style={[T.body, { textAlign: 'center', marginTop: 8, color: C.sub, maxWidth: 360 }]}>{ch.about}</Text>
      </View>

      {!mine && ch.active ? (
        <Card style={{ padding: 20 }}>
          <Text style={T.h2}>Join the challenge</Text>
          <Text style={[T.small, { marginTop: 4, fontSize: 14 }]}>Your name shows on the Great Neck leaderboard.{ch.photo ? ' Each check-in is a quick photo that only Rabbi Zevy sees.' : ''}</Text>
          <Field label="Your name" value={setupName} onChange={setSetupName} placeholder="Like: Noah S." />
          <View style={{ marginTop: 18 }}><ReminderPicker value={hour} onChange={setHour} ch={ch} /></View>
          <View style={{ marginTop: 22 }}>
            <Button label="I'm in" color={hue.solid} disabled={setupName.trim().length < 2} onPress={() => { setProfile(setupName, grade); join(ch.id, hour); }} />
          </View>
        </Card>
      ) : (
        <>
          {/* Streak hero */}
          <View style={[st.streak, { backgroundColor: hue.solid }]}>
            <View style={[u.blob, { backgroundColor: hue.deep, opacity: 0.25, right: -60, top: -80 }]} />
            <Icon name="flame" size={30} color={C.white} stroke={2} />
            <Text style={st.streakBig}>{fire}</Text>
            <Text style={st.streakLabel}>{unit(ch, fire)} in a row</Text>
          </View>
          <Card style={{ marginTop: 14, padding: 18 }}>
            <Week ch={ch} />
          </Card>

          {ch.active && mine ? (
            <View style={{ marginTop: 18 }}>
              <Button
                label={busy ? 'Checking in…' : done ? doneLabel(ch) : ch.photo ? 'Snap my photo' : 'Check in'}
                icon={done ? 'tick' : ch.photo ? 'camera' : undefined}
                color={hue.solid}
                disabled={busy || done}
                onPress={doCheck}
              />
              {ch.photo && !done ? <Text style={[T.small, { textAlign: 'center', marginTop: 8 }]}>Take a photo of your tefillin on. Only Rabbi Zevy sees it, and it is deleted after 30 days.</Text> : null}
            </View>
          ) : null}
          {photo ? <Image source={{ uri: photo }} style={st.photo} resizeMode="cover" accessibilityLabel="Your check-in photo" /> : null}
          {note ? <Text style={st.note} accessibilityLiveRegion="polite">{note}</Text> : null}

          <View style={st.progressRow}>
            <Text style={T.h3}>{count} of {ch.goal}</Text>
            <Text style={T.small}>{next ? `${next.at - count} to the next reward` : 'All rewards unlocked'}</Text>
          </View>
          <Bar ch={ch} count={count} height={10} />
        </>
      )}

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
        {ch.rewards.length === 0 ? <Text style={[T.small, { padding: 16 }]}>Rewards will be announced.</Text> : null}
      </Card>

      <Text style={st.section}>Great Neck leaderboard</Text>
      {board === null ? <Text style={T.small}>Loading…</Text> : board.length === 0 ? <Text style={T.small}>Nobody yet. Be the first on the board.</Text> : (
        <Card style={{ padding: 0 }}>
          {board.slice(0, 10).map((r, i) => (
            <View key={i} style={[st.row, i > 0 && st.rule]}>
              <View style={[st.dot, { backgroundColor: i === 0 ? hue.solid : C.bg }]}>
                <Text style={[st.rank, i === 0 && { color: C.white }]}>{i + 1}</Text>
              </View>
              <Text style={[T.h3, { flex: 1 }]} numberOfLines={1}>{r.name}</Text>
              <Text style={[T.h3, { color: hue.deep }]}>{r.count}</Text>
            </View>
          ))}
        </Card>
      )}

      {mine ? (
        <>
          <View style={{ marginTop: 30 }}>
            <ReminderPicker value={hour} ch={ch} onChange={(h) => { setHour(h); join(ch.id, h); setNote(h === null ? 'Reminder turned off.' : `Reminder set for ${hourLabel(h)}.`); }} />
          </View>
          <Pressable onPress={() => leave(ch.id)} hitSlop={8} style={{ alignSelf: 'center', marginTop: 24 }} accessibilityRole="button">
            <Text style={[T.small, { textDecorationLine: 'underline' }]}>Leave this challenge</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  track: { overflow: 'hidden' },
  fillBar: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: R.pill, paddingHorizontal: 16, minHeight: 38, justifyContent: 'center' },
  pillText: { color: C.white, fontSize: 14, fontWeight: '800' },
  head: { alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 26 },
  title: { fontSize: 30, lineHeight: 34, fontWeight: '900', color: C.ink, letterSpacing: -0.5, textAlign: 'center', marginTop: 4 },
  streak: { borderRadius: 26, paddingVertical: 26, alignItems: 'center', overflow: 'hidden' },
  streakBig: { color: C.white, fontSize: 64, lineHeight: 70, fontWeight: '900', letterSpacing: -2, marginTop: 4 },
  streakLabel: { color: C.white, fontSize: 16, fontWeight: '800' },
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
