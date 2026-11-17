import React, { useEffect, useRef, useState } from 'react';
import { AppState, Animated, Easing, Image, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fire, FireBadge } from './fire';
import Svg, { Circle } from 'react-native-svg';
import { C, HUES, R, T, F } from './theme';
import { Icon, challengeIcon } from './icons';
import { nyTime, untilText, wrapWindow } from './zmanim';
import { leftText, useWrapStatus } from './wrap';
import { doneThisPeriod, hourLabel, periodKey, streak, tap, useStore, type Challenge, type ChallengeStats, type Wall as WallT, type WallPost } from './store';
import { Button, Card, Chips, Field, IconTile, s as u } from './ui';
import { snapPhoto } from './photo';

const doneLabel = (ch: Challenge) => (ch.every === 'day' ? 'Done for today' : 'Done this week');
const unit = (ch: Challenge, n: number) => (ch.every === 'day' ? `day${n === 1 ? '' : 's'}` : `week${n === 1 ? '' : 's'}`);


// Home card for a live challenge: one clear line and one clear button.
export function ChallengeBanner({ ch }: { ch: Challenge }) {
  const { checks, joined, openChallenge } = useStore();
  const w = useWrapStatus();
  const wrapNow = ch.id === 'tefillin' && !!w && w.needed;
  const hue = HUES[ch.color] ?? HUES.blue;
  const mine = joined.includes(ch.id);
  const done = doneThisPeriod(ch, checks);
  const fire = streak(ch, checks);
  const line = wrapNow && w ? (w.lastHour ? `Only ${leftText(w.left)} left to wrap today` : `${leftText(w.left)} left to wrap today`) : !mine ? 'Tap to join. Win the backpack.' : done ? `${fire} ${unit(ch, fire)} in a row. See you tomorrow.` : fire > 0 ? `${fire} ${unit(ch, fire)} in a row. Keep it alive.` : 'Start your streak today.';
  const action = !mine ? 'Join' : done ? 'Done' : ch.photo ? 'Snap' : 'Check in';
  return (
    <Card style={st.banner} onPress={() => openChallenge(ch.id)} label={`${ch.title}. ${line}`}>
      {ch.id === 'tefillin' ? <FireBadge lit={done} streak={fire} size={50} /> : <IconTile icon={challengeIcon(ch)} color={ch.color} size={52} solid />}
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

const REMINDERS_ALL = [
  { l: 'No reminder', h: null },
  { l: '7:00 AM', h: 7 },
  { l: '4:00 PM', h: 16 },
  { l: '8:00 PM', h: 20 },
] as const;

const TEFILLIN_REMINDERS = [
  { l: 'No reminder', h: null },
  { l: '7:00 AM', h: 7 },
  { l: '8:00 AM', h: 8 },
  { l: '12:00 PM', h: 12 },
  { l: '3:00 PM', h: 15 },
] as const;

function ReminderPicker({ value, onChange, ch }: { value: number | null; onChange: (h: number | null) => void; ch: Challenge }) {
  const { push } = useStore();
  const REMINDERS = ch.id === 'tefillin' ? TEFILLIN_REMINDERS : REMINDERS_ALL;
  return (
    <View>
      <Text style={u.fieldLabel}>{ch.every === 'day' ? 'Remind me every day' : 'Remind me every Friday'}</Text>
      <Chips wrap options={REMINDERS.map((r) => r.l)} value={REMINDERS.find((r) => r.h === value)?.l ?? REMINDERS[0].l} onChange={(l) => onChange(REMINDERS.find((r) => r.l === l)!.h)} />
      {push === 'unsupported' ? <Text style={[T.small, { marginTop: 6, fontSize: 12 }]}>Reminders work in the app on your phone.</Text> : null}
      {push === 'blocked' ? <Text style={[T.small, { marginTop: 6, fontSize: 12 }]}>Notifications are off for CTeen GN in your phone's Settings.</Text> : null}
    </View>
  );
}


// Full page for one challenge (app/challenge/[id].tsx). Kept simple on purpose:
// the prize and your progress, one big button for today, and today's board of photos.
// Rules (server): each missed day (not Shabbat) is a strike; the 3rd strike and you're out.
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const nyToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
const isSat = (ymd: string) => new Date(ymd + 'T12:00:00Z').getUTCDay() === 6;
const stepDay = (ymd: string, n: number) => { const d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
// how many wrap days (not Shabbat) from start through today
function wrapDayNumber(start: string, today: string) {
  let n = 0;
  for (let d = start; d <= today && n < 400; d = stepDay(d, 1)) if (!isSat(d)) n++;
  return n;
}
// the date of the nth wrap day
function nthWrapDay(start: string, nth: number) {
  let n = 0, d = start;
  for (let i = 0; i < 500; i++, d = stepDay(d, 1)) if (!isSat(d) && ++n === nth) return d;
  return d;
}
const niceDay = (ymd: string) => new Date(ymd + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

export function ChallengePage({ ch }: { ch: Challenge }) {
  const { counts, checks, name, joined, reminders, join, leave, checkin, joinChallenge, fetchWall } = useStore();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [hour, setHour] = useState<number | null>(reminders[ch.id] ?? null);
  const [wall, setWall] = useState<WallT | null>(null);
  const [wallErr, setWallErr] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const [pending, setPending] = useState<{ uri: string; base64: string } | null>(null);
  const [caption, setCaption] = useState('');
  const [party, setParty] = useState<{ count: number; streak: number } | null>(null);
  const hue = HUES[ch.color] ?? HUES.blue;
  const mine = joined.includes(ch.id);
  const timed = ch.id === 'tefillin';
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!timed) return; const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, [timed]);
  const win = timed ? wrapWindow(now) : null;
  const closed = !!win && win.state !== 'open';
  const ws = useWrapStatus();

  // where we are in the challenge
  const starts = ch.starts || (ch.id === 'tefillin' ? '2026-11-15' : '');
  const today = nyToday();
  const dayNum = starts && ch.every === 'day' ? Math.min(ch.goal, wrapDayNumber(starts, today)) : 0;
  const lastDay = starts && ch.every === 'day' ? nthWrapDay(starts, ch.goal) : '';
  const prize = ch.rewards[ch.rewards.length - 1];

  useEffect(() => {
    if (!mine || !ch.photo) return;
    let alive = true;
    fetchWall(ch.id, today).then((r) => {
      if (!alive) return;
      if ('error' in r) { if (!wall) setWallErr(r.error); return; }
      setWallErr(null);
      setWall(r);
    });
    return () => { alive = false; };
  }, [ch.id, reload, mine]);

  useFocusEffect(React.useCallback(() => {
    if (!mine || !ch.photo) return;
    const tick = setInterval(() => { if (AppState.currentState === 'active') setReload((k) => k + 1); }, 10000);
    return () => clearInterval(tick);
  }, [mine, ch.photo]));

  // numbers come from the server (the same on every phone); fall back to this phone's record
  const me: ChallengeStats = wall?.me ?? { count: counts[ch.id] ?? 0, streak: streak(ch, checks), strikes: 0, out: false, goal: ch.goal, done: doneThisPeriod(ch, checks) };
  const done = me.done || doneThisPeriod(ch, checks);
  const left = Math.max(0, me.goal - me.count);

  const doJoin = async () => {
    setBusy(true); setNote(null);
    const e = await joinChallenge(ch.id, name, hour);
    setBusy(false);
    if (e) setNote(e);
    else setReload((k) => k + 1);
  };
  const doCheck = async () => {
    setNote(null);
    if (ch.photo) {
      const snap = await snapPhoto();
      if (!snap) return;
      if ('error' in snap) return setNote(snap.error);
      setCaption('');
      setPending(snap); // show the photo with a caption box before posting
      return;
    }
    await post();
  };
  const post = async (base64?: string, cap?: string) => {
    setBusy(true);
    const r = await checkin(ch.id, base64, cap);
    setBusy(false);
    if (r.error) { setPending(null); return setNote(r.error); }
    if (pending && !r.already) {
      tap(true);
      setParty({ count: r.count ?? me.count + 1, streak: me.streak + 1 }); // the sheet turns into the celebration
    }
    setPending(null);
    setNote(r.already ? 'You already posted today.' : null);
    setReload((k) => k + 1);
  };

  const total = wall ? wall.posts.length + wall.waiting.length : 0;
  const dayLine = !starts ? '' : today < starts ? `Starts ${niceDay(starts)}` : isSat(today) ? `Shabbat · day ${dayNum} of ${ch.goal}` : `Day ${dayNum} of ${ch.goal}`;

  return (
    <View style={{ paddingBottom: 24 }}>
      {/* title */}
      <View style={st.top}>
        {timed ? <Fire size={58} lit={done} /> : <IconTile icon={challengeIcon(ch)} color={ch.color} size={54} solid />}
        <View style={{ flex: 1 }}>
          <Text style={st.topTitle} numberOfLines={2}>{ch.title}</Text>
          {dayLine ? <Text style={st.topSub}>{dayLine}{lastDay ? ` · ends ${niceDay(lastDay)}` : ''}</Text> : null}
        </View>
      </View>

      {/* the prize and your progress */}
      <View style={st.prize}>
        <View style={[u.blob, { backgroundColor: hue.solid, opacity: 0.35, right: -80, top: -110 }]} />
        <Text style={st.prizeEyebrow}>{prize ? `Finish all ${prize.at}, win` : `Goal: ${ch.goal}`}</Text>
        {prize ? <Text style={st.prizeName}>{prize.prize}</Text> : null}
        {mine ? (
          <>
            <View style={st.prizeTrack}><View style={[st.prizeFill, { width: `${Math.min(100, (me.count / Math.max(1, me.goal)) * 100)}%`, backgroundColor: hue.solid }]} /></View>
            <View style={st.prizeRow}>
              <Text style={st.prizeCount}>{me.count} <Text style={st.prizeOf}>of {me.goal} days</Text></Text>
              <Text style={st.prizeLeft}>{me.out ? 'Out' : left === 0 ? 'Done' : `${left} to go`}</Text>
            </View>
          </>
        ) : (
          <Text style={st.prizeSub}>Everyone who finishes wins. No luck needed.</Text>
        )}
      </View>

      {!mine ? (
        ch.active ? (
          <View style={{ marginTop: 18 }}>
            <View style={st.steps}>
              <Step icon={challengeIcon(ch)} title={ch.id === 'tefillin' ? 'Wrap tefillin' : 'Do it'} sub={ch.every === 'day' ? "Every day. Shabbat doesn't count." : 'Once a week.'} />
              {ch.photo ? <Step icon="camera" title="Snap a selfie" sub={timed ? 'Between sunrise and sunset.' : 'Right here in the app.'} /> : null}
              <Step icon="send" title="Post it here" sub="Everyone in the challenge sees today's photos." last />
            </View>
            <View style={{ marginTop: 16 }}><ReminderPicker value={hour} onChange={setHour} ch={ch} /></View>
            <View style={{ marginTop: 18 }}>
              <Button label={busy ? 'Joining…' : `Join as ${name.split(' ')[0] || 'me'}`} color={hue.solid} disabled={busy || name.trim().length < 2} onPress={doJoin} />
            </View>
            {note ? <Text style={st.note}>{note}</Text> : null}
          </View>
        ) : <Text style={[T.body, { textAlign: 'center', marginTop: 18 }]}>This challenge has ended.</Text>
      ) : (
        <>
          {/* today: one clear thing to do */}
          {me.out ? (
            <View style={st.stateCard}>
              <View style={[st.stateIcon, { backgroundColor: '#FBE4E7' }]}><Icon name="x" size={22} color="#C0303F" stroke={2.6} /></View>
              <View style={{ flex: 1 }}>
                <Text style={T.h3}>You're out of this one</Text>
                <Text style={T.small}>3 missed days. Talk to Rabbi Zevy about the next challenge.</Text>
              </View>
            </View>
          ) : done ? (
            <View style={st.stateCard}>
              <View style={[st.stateIcon, { backgroundColor: C.green }]}><Icon name="tick" size={22} color={C.white} stroke={3} /></View>
              <View style={{ flex: 1 }}>
                <Text style={T.h3}>Done for today</Text>
                <Text style={T.small}>{left > 0 ? `See you tomorrow. ${left} to go.` : 'You did all of it. Rabbi Zevy will be in touch about your prize.'}</Text>
              </View>
            </View>
          ) : closed ? (
            <View style={st.stateCard}>
              <View style={[st.stateIcon, { backgroundColor: C.line }]}><Icon name={win!.state === 'before' ? 'sun' : win!.state === 'shabbat' ? 'flame' : 'lock'} size={22} color={C.sub} stroke={2.2} /></View>
              <View style={{ flex: 1 }}>
                <Text style={T.h3}>{win!.state === 'shabbat' ? 'Shabbat Shalom' : win!.state === 'before' ? `Opens at ${nyTime(win!.rise)}` : 'Closed for today'}</Text>
                <Text style={T.small}>{win!.state === 'shabbat' ? "No tefillin today. It doesn't count as a miss." : win!.state === 'before' ? `Sunrise. That's in ${untilText(win!.rise - now)}.` : `Closed at sunset (${nyTime(win!.set)}). Back tomorrow at sunrise.`}</Text>
              </View>
            </View>
          ) : (
            <Pressable onPress={doCheck} disabled={busy || !ch.active} style={({ pressed }) => [st.snap, { backgroundColor: ws?.lastHour ? '#E8742A' : hue.solid }, pressed && { transform: [{ scale: 0.98 }], opacity: 0.95 }]} accessibilityRole="button" accessibilityLabel="Snap today's selfie">
              <View style={st.snapIconWrap}><Icon name={ch.photo ? 'camera' : 'tick'} size={24} color={hue.solid} stroke={2.2} /></View>
              <View style={{ flex: 1 }}>
                <Text style={st.snapText}>{busy ? 'Posting…' : ch.photo ? "Snap today's selfie" : 'Check in for today'}</Text>
                {win ? <Text style={st.snapSub}>{win.friday ? 'Before candle lighting' : 'Before sunset'}, {nyTime(win.set)}</Text> : null}
              </View>
              {ws && ws.left > 0 ? (
                <View style={st.snapTimer}><Text style={st.snapTimerText}>{leftText(ws.left)}</Text><Text style={st.snapTimerLabel}>left</Text></View>
              ) : <Icon name="right" size={20} color="rgba(255,255,255,0.85)" stroke={2.4} />}
            </Pressable>
          )}
          {me.strikes > 0 && !me.out ? <Text style={st.strikeNote}>{me.strikes === 1 ? 'You missed 1 day.' : `You missed ${me.strikes} days.`} A 3rd miss and you're out.</Text> : null}
          {note ? <Text style={st.note} accessibilityLiveRegion="polite">{note}</Text> : null}

          {/* today's board */}
          {ch.photo ? (
            <View style={{ marginTop: 28 }}>
              <View style={st.wallHead}>
                <Text style={st.section0}>Today</Text>
                <View style={st.liveRow}><View style={st.liveDot} /><Text style={T.small}>{wall ? `${wall.posts.length} of ${total} wrapped` : 'Live'}</Text></View>
              </View>
              {wallErr ? <Text style={[T.small, { marginTop: 12 }]}>{wallErr}</Text> : !wall ? <BoardSkeleton /> : <Board wall={wall} onOpen={setOpen} />}
              <Text style={st.boardHint}>Updates live. Tap a photo to see it big, react and comment.</Text>
            </View>
          ) : null}

          <View style={{ marginTop: 30 }}>
            <ReminderPicker value={hour} ch={ch} onChange={(h) => { setHour(h); join(ch.id, h); setNote(h === null ? 'Reminder turned off.' : `Reminder set for ${hourLabel(h)}.`); }} />
          </View>
          <Pressable onPress={() => leave(ch.id)} hitSlop={8} style={{ alignSelf: 'center', marginTop: 24 }} accessibilityRole="button">
            <Text style={[T.small, { textDecorationLine: 'underline' }]}>Leave this challenge</Text>
          </Pressable>
          <PhotoViewer ch={ch} posts={wall?.posts ?? []} start={open} onClose={() => setOpen(null)} onChanged={() => setReload((k) => k + 1)} />
          <Modal visible={!!pending || !!party} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setPending(null); setParty(null); }}>
            <View style={{ flex: 1, backgroundColor: C.bg }}>
              {party ? <Celebrate ch={ch} count={party.count} streak={party.streak} onClose={() => setParty(null)} /> : (
              <ScrollView automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive" contentContainerStyle={{ padding: 20, paddingBottom: 40, maxWidth: 600, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
                <View style={st.sheetHead}>
                  <Text style={[T.h2, { flex: 1 }]}>Today's selfie</Text>
                  <Pressable onPress={() => setPending(null)} style={st.sheetClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cancel"><Icon name="x" size={18} color={C.ink} stroke={2.4} /></Pressable>
                </View>
                {pending ? <Image source={{ uri: pending.uri }} style={st.bigPhoto} resizeMode="cover" accessibilityLabel="Your photo" /> : null}
                <TextInput value={caption} onChangeText={setCaption} placeholder="Add a caption (optional)" placeholderTextColor={C.faint} maxLength={140} style={st.captionInput} accessibilityLabel="Caption" />
                <View style={{ marginTop: 14 }}>
                  <Button label={busy ? 'Posting…' : 'Post'} color={hue.solid} disabled={busy} onPress={() => pending && post(pending.base64, caption.trim())} />
                </View>
                <Pressable onPress={doCheck} hitSlop={8} style={{ alignSelf: 'center', marginTop: 14 }} accessibilityRole="button"><Text style={u.link}>Retake</Text></Pressable>
              </ScrollView>
              )}
            </View>
          </Modal>
        </>
      )}
    </View>
  );
}

function Step({ icon, title, sub, last }: { icon: string; title: string; sub: string; last?: boolean }) {
  return (
    <View style={[st.step, !last && st.stepLine]}>
      <View style={st.stepIcon}><Icon name={icon} size={20} color={C.blueDeep} stroke={2} /></View>
      <View style={{ flex: 1 }}>
        <Text style={T.h3}>{title}</Text>
        <Text style={T.small}>{sub}</Text>
      </View>
    </View>
  );
}

// Today's photos: big squares, 3 across, the name and the time under each. People who haven't
// posted yet are a soft grey square with their initial. As long as the list needs to be.
const COLS = 3;
function Board({ wall, onOpen }: { wall: WallT; onOpen: (i: number) => void }) {
  return (
    <View style={st.board}>
      {wall.posts.map((p, i) => (
        <Pressable key={p.key} onPress={() => onOpen(i)} style={({ pressed }) => [st.cell, pressed && { opacity: 0.85 }]} accessibilityRole="button" accessibilityLabel={`${p.name}, ${timeOf(p.at)}`}>
          <View style={st.square}>
            <Image source={{ uri: p.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            {p.status === 'checked' ? <View style={st.checkBadge}><Icon name="tick" size={10} color="#FFFFFF" stroke={3.2} /></View> : null}
          </View>
          <Text style={st.cellName} numberOfLines={1}>{p.mine ? 'You' : p.name}</Text>
          <Text style={st.cellTime}>{timeOf(p.at)}</Text>
        </Pressable>
      ))}
      {wall.waiting.map((w, i) => (
        <View key={'w' + i} style={st.cell} accessibilityLabel={`${w.name}, ${w.out ? 'out' : 'not yet'}`}>
          <View style={[st.square, st.squareWaiting]}>
            <Text style={st.waitingInitial}>{w.name[0]?.toUpperCase()}</Text>
          </View>
          <Text style={[st.cellName, { color: C.sub }]} numberOfLines={1}>{w.mine ? 'You' : w.name}</Text>
          <Text style={st.cellTime}>{w.out ? 'Out' : 'Not yet'}</Text>
        </View>
      ))}
    </View>
  );
}

// Grey squares that breathe while the day's photos load.
function BoardSkeleton() {
  const a = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(a, { toValue: 0.45, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View style={[st.board, { opacity: a }]} accessibilityLabel="Loading photos">
      {[...Array(6)].map((_, i) => <View key={i} style={st.cell}><View style={[st.square, st.squareWaiting]} /><View style={st.skelLine} /></View>)}
    </Animated.View>
  );
}

// After posting: the fire lights up with sparks, and the streak number.
function Celebrate({ ch, count, streak: days, onClose }: { ch: Challenge; count: number; streak: number; onClose: () => void }) {
  const nd = Platform.OS !== 'web';
  const text = useRef(new Animated.Value(0)).current;
  const num = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(450),
      Animated.parallel([
        Animated.spring(num, { toValue: 1, friction: 5, tension: 90, useNativeDriver: nd }),
        Animated.timing(text, { toValue: 1, duration: 450, useNativeDriver: nd }),
      ]),
    ]).start();
  }, []);
  const next = ch.rewards.find((r) => r.at > count);
  return (
    <View style={st.party}>
      <Fire size={170} lit ignite />
      <Animated.Text style={[st.partyNum, { opacity: num, transform: [{ scale: num.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }]}>{days}</Animated.Text>
      <Animated.View style={{ alignItems: 'center', opacity: text, transform: [{ translateY: text.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
        <Text style={st.partyLabel}>day streak</Text>
        <Text style={st.partySub}>{count} of {ch.goal} done. Your photo is on today's board.</Text>
        {next ? <Text style={st.partyNext}>{next.at - count} more to go for the {next.prize.replace(/\s*\(.*\)$/, '')}</Text> : null}
      </Animated.View>
      <View style={{ width: '100%', marginTop: 30 }}>
        <Button label="See today's photos" color="#FF5A1F" onPress={onClose} />
      </View>
    </View>
  );
}

// Tapping a photo opens it full screen on black: swipe left and right through today's photos,
// swipe down to close. Reactions, caption and comments sit under the photo.
function PhotoViewer({ ch, posts, start, onClose, onChanged }: { ch: Challenge; posts: WallPost[]; start: number | null; onClose: () => void; onChanged: () => void }) {
  const { comment, react, name } = useStore();
  const insets = useSafeAreaInsets();
  const [w, setW] = useState(0);
  const [idx, setIdx] = useState(start ?? 0);
  const [extra, setExtra] = useState<Record<string, { comments?: WallPost['comments']; reactions?: NonNullable<WallPost['reactions']> }>>({});
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const drag = useRef(new Animated.Value(0)).current;
  const scroller = useRef<ScrollView>(null);
  useEffect(() => { if (start !== null) { setIdx(start); setShowComments(false); setText(''); drag.setValue(0); } }, [start]);
  useEffect(() => { if (w && start !== null) setTimeout(() => scroller.current?.scrollTo({ x: start * w, animated: false }), 0); }, [w, start]);
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
    onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
    onPanResponderRelease: (_, g) => {
      if (g.dy > 110 || g.vy > 1.2) Animated.timing(drag, { toValue: 900, duration: 200, useNativeDriver: Platform.OS !== 'web' }).start(onClose);
      else Animated.spring(drag, { toValue: 0, friction: 7, useNativeDriver: Platform.OS !== 'web' }).start();
    },
  })).current;
  if (start === null || !posts.length) return null;
  const post = posts[Math.min(idx, posts.length - 1)];
  const comments = extra[post.key]?.comments ?? post.comments ?? [];
  const reactions = extra[post.key]?.reactions ?? post.reactions ?? [];
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    const r = await comment(ch.id, post.key, text.trim());
    setBusy(false);
    if ('error' in r) return;
    tap();
    setExtra((e) => ({ ...e, [post.key]: { ...e[post.key], comments: [...comments, r] } }));
    setText('');
    onChanged();
  };
  const doReact = async (emoji: string) => {
    tap();
    const next = await react(ch.id, post.key, emoji);
    if (next) { setExtra((e) => ({ ...e, [post.key]: { ...e[post.key], reactions: next } })); onChanged(); }
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[st.viewer, { opacity: drag.interpolate({ inputRange: [0, 400], outputRange: [1, 0.3], extrapolate: 'clamp' }) }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Animated.View style={{ flex: 1, transform: [{ translateY: drag }] }} {...pan.panHandlers}>
            <View style={[st.viewerTop, { paddingTop: insets.top + 8 }]}>
              <View style={st.viewerAvatar}><Text style={st.viewerInitial}>{post.name[0]?.toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={st.viewerName}>{post.mine ? 'You' : post.name}</Text>
                <Text style={st.viewerTime}>Wrapped at {timeOf(post.at)}{post.status === 'checked' ? ' · Checked by Rabbi Zevy' : ''}</Text>
              </View>
              <Text style={st.viewerCount}>{idx + 1} / {posts.length}</Text>
              <Pressable onPress={onClose} hitSlop={10} style={st.viewerClose} accessibilityRole="button" accessibilityLabel="Close">
                <Icon name="x" size={18} color="#FFFFFF" stroke={2.4} />
              </Pressable>
            </View>
            <View style={{ flex: 1 }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
              <ScrollView ref={scroller} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(e) => { if (w) { setIdx(Math.round(e.nativeEvent.contentOffset.x / w)); setShowComments(false); } }}>
                {posts.map((p) => (
                  <View key={p.key} style={{ width: w || 1, height: '100%', justifyContent: 'center' }}>
                    <Image source={{ uri: p.url }} style={{ width: '100%', height: '100%' }} resizeMode="contain" accessibilityLabel={`${p.name}'s photo`} />
                  </View>
                ))}
              </ScrollView>
            </View>
            <View style={[st.viewerBottom, { paddingBottom: insets.bottom + 12 }]}>
              {post.caption ? <Text style={st.viewerCaption}><Text style={{ fontWeight: '800' }}>{post.mine ? 'You' : post.name}  </Text>{post.caption}</Text> : null}
              <View style={st.viewerReacts}>
                {['❤️', '🔥', '💪', '👏', '🙌'].map((e) => {
                  const r = reactions.find((x) => x.emoji === e);
                  return (
                    <Pressable key={e} onPress={() => doReact(e)} style={({ pressed }) => [st.vReact, r?.mine && st.vReactOn, pressed && { transform: [{ scale: 0.9 }] }]} accessibilityRole="button" accessibilityLabel={`React ${e}${r ? `, ${r.count}` : ''}`}>
                      <Text style={{ fontSize: 18 }}>{e}</Text>
                      {r ? <Text style={st.vReactCount}>{r.count}</Text> : null}
                    </Pressable>
                  );
                })}
              </View>
              <Pressable onPress={() => setShowComments((s) => !s)} hitSlop={6} accessibilityRole="button">
                <Text style={st.viewerComments}>{comments.length ? (showComments ? 'Hide comments' : `View ${comments.length === 1 ? '1 comment' : `all ${comments.length} comments`}`) : 'No comments yet'}</Text>
              </Pressable>
              {showComments ? (
                <ScrollView style={{ maxHeight: 180 }} keyboardShouldPersistTaps="handled">
                  {comments.map((c, i) => (
                    <Text key={c.at + i} style={st.viewerComment}><Text style={{ fontWeight: '800', color: c.leader ? '#7FD0F5' : '#FFFFFF' }}>{c.leader ? 'Rabbi Zevy' : c.name}  </Text>{c.text}</Text>
                  ))}
                </ScrollView>
              ) : null}
              <View style={st.viewerInputRow}>
                <View style={st.viewerMe}><Text style={st.viewerInitial}>{name[0]?.toUpperCase() || '?'}</Text></View>
                <TextInput value={text} onChangeText={setText} placeholder={`Cheer on ${post.mine ? 'yourself' : post.name.split(' ')[0]}…`} placeholderTextColor="rgba(255,255,255,0.5)" style={st.viewerInput} maxLength={200} onSubmitEditing={send} returnKeyType="send" accessibilityLabel="Add a comment" />
                <Pressable onPress={send} disabled={busy || !text.trim()} style={[st.viewerSend, (!text.trim() || busy) && { opacity: 0.35 }]} accessibilityRole="button" accessibilityLabel="Send comment">
                  <Icon name="send" size={15} color="#FFFFFF" stroke={2.4} />
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const st = StyleSheet.create({
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#E8364F' },
  square: { width: '100%', aspectRatio: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: C.line },
  squareWaiting: { alignItems: 'center', justifyContent: 'center', backgroundColor: C.line },
  waitingInitial: { fontSize: 26, fontFamily: F.display, color: C.faint },
  checkBadge: { position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: '#1FA971', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FFFFFF' },
  cellName: { fontSize: 13, fontWeight: '800', color: C.ink, marginTop: 6 },
  cellTime: { fontSize: 11, fontWeight: '600', color: C.faint, marginTop: 1, fontVariant: ['tabular-nums'] },
  skelLine: { height: 10, width: '60%', borderRadius: 5, backgroundColor: C.line, marginTop: 8 },
  partyNum: { fontSize: 76, lineHeight: 82, fontFamily: F.display, color: C.ink, marginTop: 22, fontVariant: ['tabular-nums'] },
  partyLabel: { fontSize: 15, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', color: '#FF5A1F', marginTop: -4 },
  viewer: { flex: 1, backgroundColor: '#000000' },
  viewerTop: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 10 },
  viewerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2A3440', alignItems: 'center', justifyContent: 'center' },
  viewerMe: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#2A3440', alignItems: 'center', justifyContent: 'center' },
  viewerInitial: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
  viewerName: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  viewerTime: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 1 },
  viewerCount: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  viewerClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  viewerBottom: { paddingHorizontal: 14, paddingTop: 10, gap: 10 },
  viewerCaption: { color: '#FFFFFF', fontSize: 15, lineHeight: 21 },
  viewerReacts: { flexDirection: 'row', gap: 8 },
  vReact: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, paddingHorizontal: 11, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)' },
  vReactOn: { backgroundColor: 'rgba(43,178,238,0.35)' },
  vReactCount: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  viewerComments: { color: 'rgba(255,255,255,0.65)', fontSize: 14, fontWeight: '600' },
  viewerComment: { color: 'rgba(255,255,255,0.92)', fontSize: 14, lineHeight: 20, marginBottom: 6 },
  viewerInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  viewerInput: { flex: 1, height: 42, borderRadius: 21, paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.12)', color: '#FFFFFF', fontSize: 15 },
  viewerSend: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#159FDC', alignItems: 'center', justifyContent: 'center' },
  snapTimer: { alignItems: 'flex-end' },
  snapTimerText: { fontSize: 20, fontFamily: F.display, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  snapTimerLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.85)', marginTop: -2 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
  topTitle: { fontSize: 25, lineHeight: 29, fontFamily: F.display, color: C.ink, letterSpacing: -0.5 },
  topSub: { fontSize: 14, fontWeight: '700', color: C.sub, marginTop: 3 },
  prize: { marginTop: 18, padding: 20, borderRadius: 26, backgroundColor: '#101C2A', overflow: 'hidden' },
  prizeEyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: '#F5C542' },
  prizeName: { fontSize: 22, lineHeight: 27, fontFamily: F.display, color: '#FFFFFF', marginTop: 6, letterSpacing: -0.3 },
  prizeSub: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 8 },
  prizeTrack: { height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.12)', marginTop: 18, overflow: 'hidden' },
  prizeFill: { height: 10, borderRadius: 5 },
  prizeRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 10 },
  prizeCount: { fontSize: 22, fontFamily: F.display, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  prizeOf: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.65)', fontFamily: undefined },
  prizeLeft: { fontSize: 14, fontWeight: '800', color: 'rgba(255,255,255,0.85)' },
  steps: { borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, paddingHorizontal: 16 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  stepLine: { borderBottomWidth: 1, borderBottomColor: C.line },
  stepIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.bluePale, alignItems: 'center', justifyContent: 'center' },
  stateCard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16, padding: 16, borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  stateIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  snap: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16, paddingHorizontal: 16, height: 72, borderRadius: 24 },
  snapIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  snapText: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  snapSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2, fontWeight: '600' },
  strikeNote: { fontSize: 13, color: '#B4532A', fontWeight: '700', marginTop: 10, textAlign: 'center' },
  boardHint: { fontSize: 12, color: C.faint, marginTop: 10 },
  party: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, maxWidth: 520, width: '100%', alignSelf: 'center' },
  partyStage: { width: 220, height: 200, alignItems: 'center', justifyContent: 'center' },
  partyCheck: { width: 108, height: 108, borderRadius: 54, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
  partyTitle: { fontSize: 30, fontFamily: F.display, color: C.ink, letterSpacing: -0.6, textAlign: 'center', marginTop: 6 },
  partySub: { fontSize: 15, color: C.sub, marginTop: 6, textAlign: 'center' },
  partyStats: { flexDirection: 'row', alignItems: 'center', marginTop: 22, paddingVertical: 14, paddingHorizontal: 26, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  partyStat: { alignItems: 'center', minWidth: 90 },
  partyDivider: { width: 1, height: 34, backgroundColor: C.line, marginHorizontal: 10 },
  partyNext: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: C.bluePale },
  partyNextText: { fontSize: 14, fontWeight: '800', flexShrink: 1 },
  closedCard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16, padding: 16, borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  window: { marginTop: 14, padding: 16, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  windowEnds: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  windowEnd: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  windowTime: { fontSize: 15, fontWeight: '800', color: C.ink, fontVariant: ['tabular-nums'] },
  windowState: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: C.sub },
  windowTrack: { height: 6, borderRadius: 3, backgroundColor: C.line, marginTop: 12, justifyContent: 'center' },
  windowFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3, backgroundColor: '#F5B81F' },
  windowNow: { position: 'absolute', width: 14, height: 14, borderRadius: 7, marginLeft: -7, backgroundColor: C.card, borderWidth: 3, borderColor: '#F5B81F' },
  windowNote: { fontSize: 12, color: C.faint, marginTop: 10 },
  board: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5, marginTop: 14 },
  cell: { width: '33.333%', paddingHorizontal: 5, marginBottom: 14 },
  cellWaiting: { backgroundColor: C.line, alignItems: 'center', justifyContent: 'center' },
  cellOpen: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.line, opacity: 0.6 },
  cellInitial: { fontSize: 11, fontWeight: '900', color: C.faint },
  cellCheck: { position: 'absolute', right: 3, top: 3, width: 7, height: 7, borderRadius: 4, backgroundColor: '#29C27A', borderWidth: 1, borderColor: '#fff' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, flexWrap: 'wrap' },
  legendDot: { width: 12, height: 12, borderRadius: 3, marginLeft: 6 },
  legendText: { fontSize: 12, color: C.sub, fontWeight: '700' },
  whoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  whoThumb: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.line },
  whoEmpty: { alignItems: 'center', justifyContent: 'center' },
  whoTime: { fontSize: 13, fontWeight: '800', color: C.sub, fontVariant: ['tabular-nums'] },
  captionInput: { marginTop: 14, minHeight: 50, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, paddingHorizontal: 16, fontSize: 16, color: C.ink },
  caption: { fontSize: 16, lineHeight: 23, color: C.ink, marginTop: 14 },
  reactRow: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  reactBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 40, paddingHorizontal: 12, borderRadius: R.pill, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  reactOn: { backgroundColor: C.bluePale, borderColor: C.blue },
  reactEmoji: { fontSize: 18 },
  reactCount: { fontSize: 14, fontWeight: '800', color: C.sub },
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
  ringBig: { color: C.white, fontSize: 38, lineHeight: 42, fontFamily: F.display, letterSpacing: -1 },
  ringLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  statValue: { color: C.white, fontSize: 18, fontFamily: F.display },
  snapCard: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.card, borderRadius: 24, padding: 16, borderWidth: 2, borderColor: C.line },
  snapIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  snapTitle: { fontSize: 18, fontFamily: F.display, color: C.ink },
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
  section0: { fontSize: 20, fontFamily: F.display, color: C.ink },
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
  title: { fontSize: 30, lineHeight: 34, fontFamily: F.display, color: C.ink, letterSpacing: -0.5, textAlign: 'center', marginTop: 4 },
  streak: { borderRadius: 26, paddingVertical: 22, overflow: 'hidden' },
  streakBig: { color: C.white, fontSize: 56, lineHeight: 62, fontFamily: F.display, letterSpacing: -2 },
  streakLabel: { color: C.white, fontSize: 15, lineHeight: 19, fontWeight: '800' },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  weekCol: { alignItems: 'center', gap: 6 },
  weekDot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  weekLabel: { fontSize: 11, fontWeight: '800', color: C.sub },
  photo: { width: 140, height: 140, borderRadius: 18, alignSelf: 'center', marginTop: 14, backgroundColor: C.line },
  note: { fontSize: 14, color: C.ink, fontWeight: '700', marginTop: 12, textAlign: 'center' },
  progressRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 28, marginBottom: 10 },
  section: { fontSize: 19, fontFamily: F.display, color: C.ink, marginTop: 34, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  dot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  rank: { fontSize: 14, fontWeight: '900', color: C.sub },
});
