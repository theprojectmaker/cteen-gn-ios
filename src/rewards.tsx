import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C, HUES, R, T } from './theme';
import { Icon } from './icons';
import { doneThisPeriod, fetchBoard, hourLabel, streak, useStore, type BoardRow, type Challenge } from './store';
import { Button, Card, Chips, Field, IconTile, Sheet, s as u } from './ui';

const nextReward = (ch: Challenge, count: number) => ch.rewards.find((r) => r.at > count) ?? null;
const doneLabel = (ch: Challenge) => (ch.every === 'day' ? 'Done today' : 'Done this week');

function Bar({ ch, count }: { ch: Challenge; count: number }) {
  const hue = HUES[ch.color] ?? HUES.blue;
  return (
    <View style={[st.track, { backgroundColor: hue.pale }]}>
      <View style={[st.fillBar, { width: `${Math.min(100, (count / ch.goal) * 100)}%`, backgroundColor: hue.solid }]} />
    </View>
  );
}

// Slim banner shown on Home for every challenge the rabbi has switched on.
export function ChallengeBanner({ ch }: { ch: Challenge }) {
  const { counts, checks, joined, openChallenge, checkin } = useStore();
  const [busy, setBusy] = useState(false);
  const hue = HUES[ch.color] ?? HUES.blue;
  const count = counts[ch.id] ?? 0;
  const mine = joined.includes(ch.id);
  const done = doneThisPeriod(ch, checks);
  const fire = streak(ch, checks);
  const quick = async () => {
    setBusy(true);
    const r = await checkin(ch.id);
    setBusy(false);
    if (r.error) openChallenge(ch.id);
  };
  return (
    <Card style={st.banner} onPress={() => openChallenge(ch.id)} label={ch.title}>
      <View style={st.bannerRow}>
        <IconTile icon={ch.icon || 'trophy'} color={ch.color} size={42} solid />
        <View style={{ flex: 1 }}>
          <Text style={T.h3} numberOfLines={1}>{ch.title}</Text>
          <Text style={[T.small, { marginTop: 1 }]} numberOfLines={1}>
            {!mine ? 'Live now · rewards to win' : `${count} of ${ch.goal}${fire > 1 ? ` · ${fire} in a row` : ''}`}
          </Text>
        </View>
        {!mine ? (
          <View style={[st.pill, { backgroundColor: hue.solid }]}>
            <Text style={st.pillText}>Join</Text>
          </View>
        ) : done ? (
          <View style={[st.pill, { backgroundColor: hue.pale }]}>
            <Icon name="tick" size={14} color={hue.deep} stroke={2.8} />
            <Text style={[st.pillText, { color: hue.deep }]}>Done</Text>
          </View>
        ) : (
          <Pressable onPress={quick} disabled={busy} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Check in to ${ch.title}`} style={({ pressed }) => [st.pill, { backgroundColor: hue.solid }, (pressed || busy) && { opacity: 0.7 }]}>
            <Text style={st.pillText}>{busy ? '…' : 'Check in'}</Text>
          </Pressable>
        )}
      </View>
      {mine ? <View style={{ marginTop: 12 }}><Bar ch={ch} count={count} /></View> : null}
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
    <View style={{ marginTop: 18 }}>
      <Text style={u.fieldLabel}>{ch.every === 'day' ? 'Remind me every day' : 'Remind me every Friday'}</Text>
      <Chips wrap options={REMINDERS.map((r) => r.l)} value={REMINDERS.find((r) => r.h === value)?.l ?? REMINDERS[0].l} onChange={(l) => onChange(REMINDERS.find((r) => r.l === l)!.h)} />
      {push === 'unsupported' ? <Text style={[T.small, { marginTop: 6, fontSize: 12 }]}>Reminders work in the app on your phone.</Text> : null}
      {push === 'blocked' ? <Text style={[T.small, { marginTop: 6, fontSize: 12 }]}>Notifications are off for CTeen GN in your phone's Settings.</Text> : null}
    </View>
  );
}

export function ChallengeSheet() {
  const { activeChallenge: ch, openChallenge, counts, checks, name, grade, joined, reminders, join, leave, checkin, setProfile } = useStore();
  const [board, setBoard] = useState<BoardRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [setupName, setSetupName] = useState(name);
  const [hour, setHour] = useState<number | null>(null);
  const id = ch?.id;
  useEffect(() => {
    setBoard(null); setNote(null); setSetupName(name); setHour(id ? reminders[id] ?? null : null);
    if (id) fetchBoard(id).then(setBoard).catch(() => setBoard([]));
  }, [id]);
  if (!ch) return null;
  const hue = HUES[ch.color] ?? HUES.blue;
  const count = counts[ch.id] ?? 0;
  const mine = joined.includes(ch.id);
  const done = doneThisPeriod(ch, checks);
  const fire = streak(ch, checks);
  const doCheck = async () => {
    setBusy(true); setNote(null);
    const r = await checkin(ch.id);
    setBusy(false);
    if (r.error) return setNote(r.error);
    if (r.board) setBoard(r.board);
    setNote(r.already ? 'You already checked in. Come back next time.' : 'Checked in. Keep it going.');
  };
  return (
    <Sheet onClose={() => openChallenge(null)}>
      <View style={st.head}>
        <IconTile icon={ch.icon || 'trophy'} color={ch.color} size={64} solid />
        <Text style={[T.eyebrow, { marginTop: 14, color: hue.deep }]}>{!ch.active ? 'Challenge ended' : ch.every === 'day' ? 'Daily challenge' : 'Weekly challenge'}</Text>
        <Text style={[T.h1, { fontSize: 26, lineHeight: 30, textAlign: 'center', marginTop: 4 }]}>{ch.title}</Text>
        <Text style={[T.body, { textAlign: 'center', marginTop: 6, color: C.sub }]}>{ch.about}</Text>
      </View>
      <View style={{ paddingHorizontal: 18, paddingBottom: 28 }}>
        {!mine && ch.active ? (
          // Set-up: the first time a teen opens a challenge the rabbi switched on.
          <Card>
            <Text style={T.h2}>Set it up</Text>
            <Text style={[T.small, { marginTop: 4 }]}>Takes ten seconds. Your name shows on the Great Neck leaderboard.</Text>
            <Field label="Your name" value={setupName} onChange={setSetupName} placeholder="Like: Noah S." />
            <ReminderPicker value={hour} onChange={setHour} ch={ch} />
            <View style={{ marginTop: 18 }}>
              <Button label="Join the challenge" color={hue.solid} disabled={setupName.trim().length < 2} onPress={() => { setProfile(setupName, grade); join(ch.id, hour); }} />
            </View>
          </Card>
        ) : (
          <>
            <View style={st.stats}>
              <Stat big={String(count)} label={ch.every === 'day' ? 'days done' : 'weeks done'} />
              <Stat big={String(fire)} label="in a row" />
              <Stat big={String(ch.goal)} label="goal" />
            </View>
            <View style={{ marginTop: 14 }}><Bar ch={ch} count={count} /></View>
            {ch.active && mine ? (
              <View style={{ marginTop: 16 }}>
                <Button label={busy ? 'Checking in…' : done ? doneLabel(ch) : 'Check in'} icon={done ? 'tick' : undefined} color={hue.solid} disabled={busy || done} onPress={doCheck} />
              </View>
            ) : null}
            {note ? <Text style={st.note} accessibilityLiveRegion="polite">{note}</Text> : null}
          </>
        )}

        <Text style={[T.h2, { marginTop: 26, marginBottom: 10 }]}>Rewards</Text>
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
                  <Text style={T.small}>{got ? 'Unlocked. Show this to Rabbi Zevy.' : `Unlocks at ${r.at} check-ins`}</Text>
                </View>
              </View>
            );
          })}
          {ch.rewards.length === 0 ? <Text style={[T.small, { padding: 16 }]}>Rewards will be announced.</Text> : null}
        </Card>

        <Text style={[T.h2, { marginTop: 26, marginBottom: 10 }]}>Great Neck leaderboard</Text>
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
            <ReminderPicker value={hour} ch={ch} onChange={(h) => { setHour(h); join(ch.id, h); setNote(h === null ? 'Reminder turned off.' : `Reminder set for ${hourLabel(h)}.`); }} />
            <Pressable onPress={() => { leave(ch.id); openChallenge(null); }} hitSlop={8} style={{ alignSelf: 'center', marginTop: 20 }} accessibilityRole="button">
              <Text style={[T.small, { textDecorationLine: 'underline' }]}>Leave this challenge</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </Sheet>
  );
}

function Stat({ big, label }: { big: string; label: string }) {
  return (
    <View style={st.stat}>
      <Text style={st.statBig}>{big}</Text>
      <Text style={T.small}>{label}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fillBar: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3 },
  banner: { padding: 14 },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: R.pill, paddingHorizontal: 16, minHeight: 36, justifyContent: 'center' },
  pillText: { color: C.white, fontSize: 14, fontWeight: '800' },
  head: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 30, paddingBottom: 20 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: C.card, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  statBig: { fontSize: 24, fontWeight: '900', color: C.ink, letterSpacing: -0.4 },
  note: { fontSize: 13, color: C.ink, fontWeight: '700', marginTop: 10, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  rule: { borderTopWidth: 1, borderTopColor: C.line },
  dot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  rank: { fontSize: 14, fontWeight: '900', color: C.sub },
});
