import React, { useEffect, useRef, useState } from 'react';
import { AppState, Animated, Easing, Image, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { challengeRules } from './challengeRules';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fire, FireBadge } from './fire';
import Svg, { Circle } from 'react-native-svg';
import { C, HUES, R, T, display, numeral } from './theme';
import { Icon, challengeIcon } from './icons';
import { nyTime, untilText, wrapWindow } from './zmanim';
import { leftText, useWrapStatus } from './wrap';
import { challengeFits, doneThisPeriod, hourLabel, periodKey, streak, tap, useStore, type Challenge, type ChallengeStats, type Wall as WallT, type WallPost } from './store';
import { Button, Card, Chips, Field, IconTile, s as u } from './ui';
import { Ticks } from './look';
import { snapPhoto } from './photo';

const doneLabel = (ch: Challenge) => (ch.every === 'day' ? 'Done for today' : 'Done this week');
const unit = (ch: Challenge, n: number) => (ch.every === 'day' ? `day${n === 1 ? '' : 's'}` : `week${n === 1 ? '' : 's'}`);


// Home card for a live challenge: one clear line and one clear button.
export function ChallengeBanner({ ch }: { ch: Challenge }) {
  const { checks, joined, openChallenge, counts } = useStore();
  const w = useWrapStatus();
  const wrapNow = ch.id === 'tefillin' && !!w && w.needed;
  const hue = HUES[ch.color] ?? HUES.blue;
  const mine = joined.includes(ch.id);
  const done = doneThisPeriod(ch, checks);
  const fire = streak(ch, checks);
  const line = wrapNow && w ? (w.lastHour ? `Only ${leftText(w.left)} left to wrap today` : `${leftText(w.left)} left to wrap today`) : !mine ? 'Tap to join. Win the backpack.' : done ? `${fire} ${unit(ch, fire)} in a row. See you tomorrow.` : fire > 0 ? `${fire} ${unit(ch, fire)} in a row. Keep it alive.` : 'Start your streak today.';
  const action = !mine ? 'Join' : done ? 'Done' : ch.photo ? 'Snap' : 'Check in';
  return (
    <Card style={st.bannerCard} onPress={() => openChallenge(ch.id)} label={`${ch.title}. ${line}`}>
      <View style={st.banner}>
      {ch.id === 'tefillin' ? <FireBadge lit={done} streak={fire} size={50} /> : <IconTile icon={challengeIcon(ch)} color={ch.color} size={52} solid />}
      <View style={{ flex: 1 }}>
        <Text style={T.h3} numberOfLines={2}>{ch.title}</Text>
        <Text style={[T.small, { marginTop: 2 }]} numberOfLines={2}>{line}</Text>
      </View>
      <View style={[st.pill, done && st.pillDone]}>
        {done ? <Icon name="tick" size={14} color={C.blue} stroke={2.8} /> : ch.photo && mine ? <Icon name="camera" size={14} color={C.onOrange} stroke={2.4} /> : null}
        <Text style={[st.pillText, done && { color: C.blue }]}>{action}</Text>
      </View>
      </View>
      {mine ? (
        <View style={st.bannerFoot}>
          <Ticks total={ch.goal} done={counts[ch.id] ?? 0} pending={!done} height={10} />
          <View style={st.bannerFootRow}>
            <Text style={st.bannerFootText}>{counts[ch.id] ?? 0} of {ch.goal} {unit(ch, ch.goal)}</Text>
            {ch.rewards.length ? <Text style={st.bannerFootText} numberOfLines={1}>{ch.rewards[ch.rewards.length - 1].prize}</Text> : null}
          </View>
        </View>
      ) : null}
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
  const { counts, checks, name, joined, reminders, join, leave, checkin, joinChallenge, fetchWall, gender } = useStore();
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

  if (!challengeFits(ch, gender)) {
    return (
      <View style={{ paddingTop: 40, alignItems: 'center' }}>
        <Text style={[T.h2, { textAlign: 'center' }]}>{ch.title}</Text>
        <Text style={[T.body, { textAlign: 'center', color: C.sub, marginTop: 8, maxWidth: 320 }]}>This challenge is for boys, so it's not part of your app. Check Events for what's coming up.</Text>
      </View>
    );
  }
  return (
    <View style={{ paddingBottom: 24 }}>
      {/* the leader's cover photo, when there is one */}
      {ch.image ? <View style={st.cover}><Image source={{ uri: ch.image }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel={ch.title} /></View> : null}
      {/* title */}
      <View style={st.top}>
        {timed ? <Fire size={58} lit={done} /> : <IconTile icon={challengeIcon(ch)} color={ch.color} size={54} solid />}
        <View style={{ flex: 1 }}>
          <Text style={st.topTitle} numberOfLines={2}>{ch.title}</Text>
          {dayLine ? <Text style={st.topSub}>{dayLine}{lastDay ? ` · ends ${niceDay(lastDay)}` : ''}</Text> : null}
        </View>
      </View>

      {/* the rules, in a decorated pop-up */}
      <Pressable onPress={() => router.push(`/challenge-rules/${ch.id}`)} style={({ pressed }) => [st.rulesBanner, pressed && { opacity: 0.85 }]} accessibilityRole="button" accessibilityLabel="Read the rules">
        <View style={st.rulesIcon}><Icon name="book" size={19} color={C.ink} stroke={2.1} /></View>
        <View style={{ flex: 1 }}>
          <Text style={st.rulesTitle}>The rules</Text>
          <Text style={T.small}>{challengeRules(ch).length} quick rules. Tap to read.</Text>
        </View>
        <Icon name="right" size={17} color={C.faint} stroke={2.4} />
      </Pressable>

      {/* the prize and your progress */}
      <View style={st.prize}>
        <Text style={st.prizeEyebrow}>{prize ? `Finish all ${prize.at}, win` : `Goal: ${ch.goal}`}</Text>
        {prize ? <Text style={st.prizeName}>{prize.prize}</Text> : null}
        {mine ? (
          <>
            <Ticks total={me.goal} done={me.count} pending={!done && !me.out} style={{ marginTop: 16 }} />
            <View style={st.prizeRow}>
              <View style={st.prizeCountRow}>
                <Text style={st.prizeCount}>{me.count}</Text>
                <Text style={st.prizeOf}>of {me.goal} days</Text>
              </View>
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
              <View style={[st.stateIcon, { backgroundColor: C.redPale }]}><Icon name="x" size={22} color={C.red} stroke={2.6} /></View>
              <View style={{ flex: 1 }}>
                <Text style={T.h3}>You're out of this one</Text>
                <Text style={T.small}>3 missed days. Talk to Rabbi Zevy about the next challenge.</Text>
              </View>
            </View>
          ) : done ? (
            <View style={st.stateCard}>
              <View style={[st.stateIcon, { backgroundColor: C.bluePale }]}><Icon name="tick" size={22} color={C.blue} stroke={3} /></View>
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
            <Pressable onPress={doCheck} disabled={busy || !ch.active} style={({ pressed }) => [st.snap, pressed && { transform: [{ scale: 0.98 }], opacity: 0.85 }]} accessibilityRole="button" accessibilityLabel="Snap today's selfie">
              <View style={st.snapIconWrap}><Icon name={ch.photo ? 'camera' : 'tick'} size={26} color={C.onOrange} stroke={2.2} /></View>
              <View style={{ flex: 1 }}>
                <Text style={st.snapText}>{busy ? 'Posting…' : ch.photo ? "Snap today's selfie" : 'Check in for today'}</Text>
                {win ? <Text style={st.snapSub}>{win.friday ? 'Before candle lighting' : 'Before sunset'}, {nyTime(win.set)}</Text> : null}
              </View>
              {ws && ws.left > 0 ? (
                <View style={st.snapTimer}><Text style={st.snapTimerText}>{leftText(ws.left)}</Text><Text style={st.snapTimerLabel}>left</Text></View>
              ) : <Icon name="right" size={20} color={C.onOrange} stroke={2.4} />}
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
      <View style={st.stepIcon}><Icon name={icon} size={20} color={C.ink} stroke={2} /></View>
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
            {p.status === 'checked' ? <View style={st.checkBadge}><Icon name="tick" size={10} color={C.onBlue} stroke={3.2} /></View> : null}
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
        <Button label="See today's photos" color={C.orange} onPress={onClose} />
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
                <Icon name="x" size={18} color={C.white} stroke={2.4} />
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
                    <Text key={c.at + i} style={st.viewerComment}><Text style={{ fontWeight: '800', color: c.leader ? C.blueDeep : C.white }}>{c.leader ? 'Rabbi Zevy' : c.name}  </Text>{c.text}</Text>
                  ))}
                </ScrollView>
              ) : null}
              <View style={st.viewerInputRow}>
                <View style={st.viewerMe}><Text style={st.viewerInitial}>{name[0]?.toUpperCase() || '?'}</Text></View>
                <TextInput value={text} onChangeText={setText} placeholder={`Cheer on ${post.mine ? 'yourself' : post.name.split(' ')[0]}…`} placeholderTextColor="rgba(255,255,255,0.5)" style={st.viewerInput} maxLength={200} onSubmitEditing={send} returnKeyType="send" accessibilityLabel="Add a comment" />
                <Pressable onPress={send} disabled={busy || !text.trim()} style={[st.viewerSend, (!text.trim() || busy) && { opacity: 0.35 }]} accessibilityRole="button" accessibilityLabel="Send comment">
                  <Icon name="send" size={15} color={C.onBlue} stroke={2.4} />
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
  cover: { height: 170, borderRadius: R.photo, overflow: 'hidden', backgroundColor: C.card, marginBottom: 16 },
  rulesBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, padding: 14, borderRadius: R.card, backgroundColor: C.card },
  rulesIcon: { width: 40, height: 40, borderRadius: R.chip, borderWidth: 1, borderColor: C.lineStrong, alignItems: 'center', justifyContent: 'center' },
  rulesTitle: { ...T.h3 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.red },
  square: { width: '100%', aspectRatio: 1, borderRadius: R.photo, overflow: 'hidden', backgroundColor: C.card },
  squareWaiting: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', borderWidth: 1, borderStyle: 'dashed', borderColor: C.lineStrong },
  waitingInitial: { ...display(28, C.faint) },
  checkBadge: { position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.bg },
  cellName: { fontSize: 13, fontWeight: '800', color: C.ink, marginTop: 6 },
  cellTime: { fontSize: 11, fontWeight: '600', color: C.faint, marginTop: 1, fontVariant: ['tabular-nums'] },
  skelLine: { height: 10, width: '60%', borderRadius: 5, backgroundColor: C.line, marginTop: 8 },
  partyNum: { ...numeral(88), marginTop: 22 },
  partyLabel: { ...T.eyebrow, fontSize: 13, color: C.orangeText },
  viewer: { flex: 1, backgroundColor: '#000000' },
  viewerTop: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 10 },
  viewerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.avatar, alignItems: 'center', justifyContent: 'center' },
  viewerMe: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.avatar, alignItems: 'center', justifyContent: 'center' },
  viewerInitial: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
  viewerName: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  viewerTime: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 1 },
  viewerCount: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  viewerClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  viewerBottom: { paddingHorizontal: 14, paddingTop: 10, gap: 10 },
  viewerCaption: { color: '#FFFFFF', fontSize: 15, lineHeight: 21 },
  viewerReacts: { flexDirection: 'row', gap: 8 },
  vReact: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, paddingHorizontal: 11, borderRadius: R.chip, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'transparent' },
  vReactOn: { backgroundColor: C.bluePale, borderColor: C.blue },
  vReactCount: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  viewerComments: { color: 'rgba(255,255,255,0.65)', fontSize: 14, fontWeight: '600' },
  viewerComment: { color: 'rgba(255,255,255,0.92)', fontSize: 14, lineHeight: 20, marginBottom: 6 },
  viewerInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  viewerInput: { flex: 1, height: 42, borderRadius: R.input, paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.12)', color: C.white, fontSize: 15 },
  viewerSend: { width: 38, height: 38, borderRadius: R.btnSm, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  snapTimer: { alignItems: 'flex-end' },
  snapTimerText: { ...numeral(26, C.onOrange) },
  snapTimerLabel: { ...T.eyebrow, fontSize: 11, color: C.onOrange },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
  topTitle: { ...display(30) },
  topSub: { ...T.eyebrow, marginTop: 5 },
  prize: { marginTop: 18, padding: 18, borderRadius: R.card, backgroundColor: C.card },
  prizeEyebrow: { ...T.eyebrow, color: C.orangeText },
  prizeName: { ...display(26), marginTop: 5 },
  prizeSub: { fontSize: 14, color: C.sub, marginTop: 8 },
  prizeRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 10 },
  prizeCountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  prizeCount: { ...numeral(28, C.blue) },
  prizeOf: { fontSize: 14, fontWeight: '600', color: C.sub },
  prizeLeft: { ...T.eyebrow },
  steps: { borderRadius: R.card, backgroundColor: C.card, paddingHorizontal: 16 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  stepLine: { borderBottomWidth: 1, borderBottomColor: C.line },
  stepIcon: { width: 40, height: 40, borderRadius: R.chip, borderWidth: 1, borderColor: C.lineStrong, alignItems: 'center', justifyContent: 'center' },
  stateCard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16, padding: 16, borderRadius: R.card, backgroundColor: C.card },
  stateIcon: { width: 46, height: 46, borderRadius: R.chip, alignItems: 'center', justifyContent: 'center' },
  snap: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, paddingHorizontal: 16, height: 72, borderRadius: R.btn, backgroundColor: C.orange },
  snapIconWrap: { width: 34, height: 44, alignItems: 'center', justifyContent: 'center' },
  snapText: { ...display(23, C.onOrange), letterSpacing: 1.1 },
  snapSub: { fontSize: 13, color: C.onOrange, marginTop: 1, fontWeight: '600' },
  strikeNote: { fontSize: 13, color: C.orangeText, fontWeight: '700', marginTop: 10, textAlign: 'center' },
  boardHint: { fontSize: 12, color: C.faint, marginTop: 10 },
  party: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, maxWidth: 520, width: '100%', alignSelf: 'center' },
  partySub: { fontSize: 15, color: C.sub, marginTop: 6, textAlign: 'center' },
  partyNext: { marginTop: 14, paddingVertical: 10, paddingHorizontal: 14, borderRadius: R.chip, backgroundColor: C.bluePale, overflow: 'hidden', fontSize: 14, fontWeight: '600', color: C.ink, textAlign: 'center' },
  board: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5, marginTop: 14 },
  cell: { width: '33.333%', paddingHorizontal: 5, marginBottom: 14 },
  captionInput: { marginTop: 14, minHeight: 50, borderRadius: R.input, backgroundColor: C.card, borderWidth: 1, borderColor: C.lineStrong, paddingHorizontal: 16, fontSize: 16, color: C.ink },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  sheetClose: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassLine, alignItems: 'center', justifyContent: 'center' },
  bigPhoto: { width: '100%', aspectRatio: 3 / 4, borderRadius: R.photo, backgroundColor: C.card },
  wallHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
  section0: { ...T.h2 },
  bannerCard: { padding: 16 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  bannerFoot: { marginTop: 14 },
  bannerFootRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  bannerFootText: { fontSize: 12, fontWeight: '700', color: C.sub, flexShrink: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: R.btnSm, paddingHorizontal: 16, minHeight: 36, justifyContent: 'center', backgroundColor: C.orange, borderWidth: 1.5, borderColor: C.orange },
  pillDone: { backgroundColor: 'transparent', borderColor: C.blue },
  pillText: { ...display(19, C.onOrange), letterSpacing: 1.1 },
  note: { fontSize: 14, color: C.ink, fontWeight: '700', marginTop: 12, textAlign: 'center' },
});
