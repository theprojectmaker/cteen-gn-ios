import React, { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { C, HUES, R, T } from './theme';
import { Icon } from './icons';
import { doneThisPeriod, hourLabel, periodKey, streak, useStore, type Challenge, type ChallengeStats, type Wall as WallT, type WallPost } from './store';
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

// Full page for one challenge (app/challenge/[id].tsx): sign up, then every day snap a photo.
// Everyone in the challenge shows in a grid: a photo with the time they posted, or a grey slot
// if they haven't yet. Miss a day and your streak resets; the 2nd miss adds one extra day;
// the 3rd miss and you're out.
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Shabbat'];
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const nyDay = (back: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(Date.now() - back * 86400000));

export function ChallengePage({ ch }: { ch: Challenge }) {
  const { counts, checks, name, joined, reminders, join, leave, checkin, joinChallenge, fetchWall } = useStore();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [setupName, setSetupName] = useState(name);
  useEffect(() => { if (!setupName && name) setSetupName(name); }, [name]); // saved name loads a moment after the page
  const [hour, setHour] = useState<number | null>(reminders[ch.id] ?? null);
  const [day, setDay] = useState(0); // 0 = today, 1 = yesterday...
  const [wall, setWall] = useState<WallT | null>(null);
  const [wallErr, setWallErr] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState<WallPost | null>(null);
  const hue = HUES[ch.color] ?? HUES.blue;
  const mine = joined.includes(ch.id);

  useEffect(() => {
    if (!mine || !ch.photo) return;
    let alive = true;
    setWallErr(null);
    fetchWall(ch.id, nyDay(day)).then((r) => {
      if (!alive) return;
      if ('error' in r) { setWallErr(r.error); setWall(null); return; }
      setWall(r);
    });
    return () => { alive = false; };
  }, [ch.id, day, reload, mine]);

  // Numbers come from the server (the same on every phone); fall back to this phone's record.
  const me: ChallengeStats = wall?.me ?? { count: counts[ch.id] ?? 0, streak: streak(ch, checks), strikes: 0, out: false, goal: ch.goal, done: doneThisPeriod(ch, checks) };
  const done = me.done || doneThisPeriod(ch, checks);

  const doJoin = async () => {
    setBusy(true); setNote(null);
    const e = await joinChallenge(ch.id, setupName, hour);
    setBusy(false);
    if (e) setNote(e);
    else setReload((k) => k + 1);
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
    setNote(r.already ? 'You already checked in today.' : 'Posted. Nice.');
    setDay(0);
    setReload((k) => k + 1);
  };

  const labels = [...Array(7)].map((_, i) => (i === 0 ? 'Today' : i === 1 ? 'Yesterday' : DAY_NAMES[new Date(Date.now() - i * 86400000).getDay()]));
  const total = wall ? wall.posts.length + wall.waiting.length : 0;

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
            <Text style={[T.small, { marginTop: 4, fontSize: 14 }]}>Put in your name and you're in. Every day, snap a photo of you wrapping. Everyone in the challenge sees the day's photos.</Text>
            <RuleCard />
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
          <View style={[st.hero, { backgroundColor: me.out ? '#7A8693' : hue.solid }]}>
            <View style={[u.blob, { backgroundColor: hue.deep, opacity: 0.22, right: -70, top: -90 }]} />
            <View style={[u.blob, { backgroundColor: '#ffffff', opacity: 0.08, left: -90, bottom: -110 }]} />
            <View style={st.heroRow}>
              <Ring size={132} progress={Math.min(1, me.count / Math.max(1, me.goal))}>
                <Icon name="flame" size={20} color={C.white} stroke={2.2} />
                <Text style={st.ringBig}>{me.streak}</Text>
                <Text style={st.ringLabel}>{ch.every === 'day' ? 'day streak' : 'week streak'}</Text>
              </Ring>
              <View style={{ flex: 1, gap: 12 }}>
                <HeroStat label="Today" value={me.out ? 'Out' : done ? 'Done' : 'Not yet'} good={done && !me.out} />
                <HeroStat label="Check-ins" value={`${me.count} of ${me.goal}`} />
                <View>
                  <Text style={st.statLabel}>Strikes</Text>
                  <View style={st.strikes}>
                    {[0, 1, 2].map((i) => <View key={i} style={[st.strike, i < me.strikes && st.strikeOn]} />)}
                  </View>
                </View>
              </View>
            </View>
            <View style={st.weekOnBlue}><Week ch={ch} light /></View>
          </View>

          {me.out ? (
            <View style={st.outCard}>
              <Icon name="x" size={22} color="#C0303F" stroke={2.6} />
              <View style={{ flex: 1 }}>
                <Text style={T.h3}>You're out of this challenge</Text>
                <Text style={T.small}>You missed 3 days. Talk to Rabbi Zevy about the next one.</Text>
              </View>
            </View>
          ) : ch.active ? (
            done ? (
              <View style={st.doneCard}>
                <View style={st.doneIcon}><Icon name="tick" size={22} color={C.white} stroke={3} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={T.h3}>{doneLabel(ch)}</Text>
                  <Text style={T.small}>Come back {ch.every === 'day' ? 'tomorrow' : 'next week'} to keep your streak.</Text>
                </View>
              </View>
            ) : (
              <Pressable onPress={doCheck} disabled={busy} style={({ pressed }) => [st.snapCard, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="button" accessibilityLabel={ch.photo ? "Snap today's photo" : 'Check in'}>
                <View style={[st.snapIcon, { backgroundColor: hue.solid }]}>
                  <Icon name={ch.photo ? 'camera' : 'tick'} size={28} color={C.white} stroke={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.snapTitle}>{busy ? 'Posting…' : ch.photo ? "Snap today's photo" : 'Check in for today'}</Text>
                  <Text style={T.small}>{me.strikes > 0 ? `${me.strikes} of 3 strikes. Don't miss today.` : 'Wrap tefillin, then take a quick photo.'}</Text>
                </View>
                <Icon name="right" size={20} color={C.faint} stroke={2.4} />
              </Pressable>
            )
          ) : null}
          {note ? <Text style={st.note} accessibilityLiveRegion="polite">{note}</Text> : null}

          {ch.photo ? (
            <View style={{ marginTop: 30 }}>
              <View style={st.wallHead}>
                <Text style={st.section0}>{day === 0 ? 'Today' : labels[day]}</Text>
                <Text style={T.small}>{wall ? `${wall.posts.length} of ${total} wrapped` : ''}</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingVertical: 4 }}>
                {labels.map((l, i) => (
                  <Pressable key={l + i} onPress={() => setDay(i)} style={[u.chip, i === day && u.chipOn]} accessibilityRole="button" accessibilityState={{ selected: i === day }}>
                    <Text style={[u.chipText, i === day && u.chipTextOn]}>{l}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              {wallErr ? <Text style={[T.small, { marginTop: 12 }]}>{wallErr}</Text> : !wall ? <Text style={[T.small, { marginTop: 12 }]}>Loading…</Text> : (
                <View style={st.grid}>
                  {wall.posts.map((p) => (
                    <Pressable key={p.key} onPress={() => setOpen(p)} style={({ pressed }) => [st.tile, pressed && { transform: [{ scale: 0.97 }] }]} accessibilityRole="button" accessibilityLabel={`${p.name}, ${timeOf(p.at)}`}>
                      <Image source={{ uri: p.url }} style={u.fill} resizeMode="cover" />
                      <View style={st.tileShade} />
                      {p.status === 'checked' ? <View style={st.tileCheck}><Icon name="tick" size={11} color={C.white} stroke={3} /></View> : null}
                      <Text style={st.tileName} numberOfLines={1}>{p.mine ? 'You' : p.name}</Text>
                      <Text style={st.tileTime}>{timeOf(p.at)}</Text>
                    </Pressable>
                  ))}
                  {wall.waiting.map((w, i) => (
                    <View key={w.name + i} style={[st.tile, st.tileEmpty]} accessibilityLabel={`${w.name}, ${w.out ? 'out' : day === 0 ? 'not yet' : 'missed'}`}>
                      <View style={st.emptyAvatar}><Text style={st.emptyInitial}>{w.name[0]?.toUpperCase()}</Text></View>
                      <Text style={st.emptyName} numberOfLines={1}>{w.mine ? 'You' : w.name}</Text>
                      <Text style={st.emptyState}>{w.out ? 'Out' : day === 0 ? 'Not yet' : 'Missed'}</Text>
                    </View>
                  ))}
                  {total === 0 ? <Text style={[T.small, { marginTop: 4 }]}>No one has signed up yet.</Text> : null}
                </View>
              )}
            </View>
          ) : null}

          <RuleCard />
          <Rewards ch={ch} count={me.count} mine={mine} />

          <View style={{ marginTop: 30 }}>
            <ReminderPicker value={hour} ch={ch} onChange={(h) => { setHour(h); join(ch.id, h); setNote(h === null ? 'Reminder turned off.' : `Reminder set for ${hourLabel(h)}.`); }} />
          </View>
          <Pressable onPress={() => leave(ch.id)} hitSlop={8} style={{ alignSelf: 'center', marginTop: 24 }} accessibilityRole="button">
            <Text style={[T.small, { textDecorationLine: 'underline' }]}>Leave this challenge</Text>
          </Pressable>
          <PhotoSheet ch={ch} post={open} onClose={() => setOpen(null)} />
        </>
      )}
    </View>
  );
}

function RuleCard() {
  return (
    <View style={st.rule}>
      <Text style={st.ruleTitle}>The rules</Text>
      <Text style={st.ruleLine}>1. Snap a photo every day. Shabbat doesn't count.</Text>
      <Text style={st.ruleLine}>2. Miss a day: your streak resets (strike 1).</Text>
      <Text style={st.ruleLine}>3. Miss again: streak resets and you add one extra day (strike 2).</Text>
      <Text style={st.ruleLine}>4. A third miss and you're out.</Text>
    </View>
  );
}

// Circular progress toward the goal, with the streak in the middle.
function Ring({ size, progress, children }: { size: number; progress: number; children: React.ReactNode }) {
  const stroke = 10, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.25)" strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#ffffff" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - progress)} />
      </Svg>
      {children}
    </View>
  );
}

function HeroStat({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <View>
      <Text style={st.statLabel}>{label}</Text>
      <Text style={[st.statValue, good && { color: '#D9FFE9' }]}>{value}</Text>
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
            <View key={r.at} style={[st.row, i > 0 && st.ruleTop]}>
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

// Tapping a photo opens it in Apple's card-style sheet (drag down to close), with comments.
function PhotoSheet({ ch, post, onClose }: { ch: Challenge; post: WallPost | null; onClose: () => void }) {
  const { comment } = useStore();
  const [comments, setComments] = useState<WallPost['comments']>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setComments(post?.comments ?? []); setText(''); setErr(null); }, [post?.key]);
  if (!post) return null;
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
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View style={st.sheetGrab} />
          <View style={{ paddingHorizontal: 20, maxWidth: 600, width: '100%', alignSelf: 'center' }}>
            <View style={st.sheetHead}>
              <View style={st.avatar}><Text style={st.avatarText}>{post.name[0]?.toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={T.h2}>{post.mine ? 'You' : post.name}</Text>
                <Text style={T.small}>Wrapped at {timeOf(post.at)}</Text>
              </View>
              <Pressable onPress={onClose} style={st.sheetClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
                <Icon name="x" size={18} color={C.ink} stroke={2.4} />
              </Pressable>
            </View>
            <Image source={{ uri: post.url }} style={st.bigPhoto} resizeMode="cover" accessibilityLabel={`${post.name}'s photo`} />
            {post.status === 'checked' ? (
              <View style={st.checkedRow}><Icon name="check" size={16} color={C.green} stroke={2.4} /><Text style={st.checkedText}>Checked by Rabbi Zevy</Text></View>
            ) : null}
            <Text style={[st.section, { marginTop: 22 }]}>Comments</Text>
            {comments.length === 0 ? <Text style={T.small}>Be the first to cheer them on.</Text> : null}
            <View style={{ gap: 10 }}>
              {comments.map((c, i) => (
                <Text key={c.at + i} style={st.comment}>
                  <Text style={[st.commentName, c.leader && { color: C.blueDeep }]}>{c.leader ? 'Rabbi Zevy' : c.name} </Text>
                  {c.text}
                </Text>
              ))}
            </View>
            <View style={st.commentRow}>
              <TextInput value={text} onChangeText={setText} placeholder="Add a comment" placeholderTextColor={C.faint} style={st.commentInput} maxLength={200} accessibilityLabel="Add a comment" onSubmitEditing={send} returnKeyType="send" />
              <Pressable onPress={send} disabled={busy || !text.trim()} style={[st.send, (!text.trim() || busy) && { opacity: 0.4 }]} accessibilityRole="button" accessibilityLabel="Send comment">
                <Icon name="send" size={18} color={C.white} stroke={2.2} />
              </Pressable>
            </View>
            {err ? <Text style={[T.small, { color: '#C0303F', marginTop: 6 }]}>{err}</Text> : null}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  strikes: { flexDirection: 'row', gap: 6, marginTop: 4 },
  strike: { width: 22, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  strikeOn: { backgroundColor: '#FFD27A' },
  outCard: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.card, borderRadius: 24, padding: 16, borderWidth: 2, borderColor: '#F2C1C7' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  tile: { width: '31.9%', aspectRatio: 3 / 4, borderRadius: 18, overflow: 'hidden', backgroundColor: C.line, justifyContent: 'flex-end', padding: 8 },
  tileShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%', backgroundColor: 'rgba(8,16,26,0.45)' },
  tileCheck: { position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: '#1A8F5C', alignItems: 'center', justifyContent: 'center' },
  tileName: { color: C.white, fontSize: 13, fontWeight: '800' },
  tileTime: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '700' },
  tileEmpty: { backgroundColor: C.card, borderWidth: 2, borderColor: C.line, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', opacity: 0.75 },
  emptyAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.line, alignItems: 'center', justifyContent: 'center' },
  emptyInitial: { fontSize: 16, fontWeight: '900', color: C.faint },
  emptyName: { fontSize: 12, fontWeight: '800', color: C.sub, marginTop: 8, maxWidth: '100%' },
  emptyState: { fontSize: 11, fontWeight: '700', color: C.faint, marginTop: 2 },
  rule: { marginTop: 22, backgroundColor: C.card, borderRadius: 18, padding: 16, gap: 6, borderWidth: 1, borderColor: C.line },
  ruleTitle: { fontSize: 15, fontWeight: '900', color: C.ink, marginBottom: 2 },
  ruleLine: { fontSize: 14, lineHeight: 20, color: C.sub },
  ruleTop: { borderTopWidth: 1, borderTopColor: C.line },
  sheetGrab: { width: 40, height: 5, borderRadius: 3, backgroundColor: C.line, alignSelf: 'center', marginTop: 8, marginBottom: 10 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  sheetClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  bigPhoto: { width: '100%', aspectRatio: 3 / 4, borderRadius: 24, backgroundColor: C.line },
  checkedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  hero: { borderRadius: 28, padding: 20, overflow: 'hidden' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  ringBig: { color: C.white, fontSize: 38, lineHeight: 42, fontWeight: '900', letterSpacing: -1 },
  ringLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  statValue: { color: C.white, fontSize: 18, fontWeight: '900' },
  snapCard: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.card, borderRadius: 24, padding: 16, borderWidth: 2, borderColor: C.line },
  snapIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  snapTitle: { fontSize: 18, fontWeight: '900', color: C.ink },
  doneCard: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.greenPale, borderRadius: 24, padding: 16 },
  doneIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  miniAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.bluePale, borderWidth: 2, borderColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  miniAvatarText: { fontSize: 12, fontWeight: '900', color: C.blueDeep },
  photoChip: { position: 'absolute', left: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(10,18,28,0.62)', borderRadius: R.pill, paddingLeft: 4, paddingRight: 14, paddingVertical: 4 },
  photoName: { color: C.white, fontSize: 14, fontWeight: '800' },
  photoTime: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  checkedOnPhoto: { position: 'absolute', right: 12, top: 12, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(26,107,69,0.92)', borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 6 },
  checkedOnPhotoText: { color: C.white, fontSize: 12, fontWeight: '800' },
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
  dot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  rank: { fontSize: 14, fontWeight: '900', color: C.sub },
});
