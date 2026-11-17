import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { C, HUES, R, T, F } from './theme';
import { Icon, challengeIcon } from './icons';
import { nyTime, untilText, wrapWindow } from './zmanim';
import { doneThisPeriod, hourLabel, periodKey, streak, tap, useStore, type Challenge, type ChallengeStats, type Wall as WallT, type WallPost } from './store';
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
      <IconTile icon={challengeIcon(ch)} color={ch.color} size={52} solid />
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
    setNote(r.already ? 'You already checked in today.' : 'Posted. Nice.');
    setDay(0);
    setReload((k) => k + 1);
  };

  const labels = [...Array(7)].map((_, i) => (i === 0 ? 'Today' : i === 1 ? 'Yesterday' : DAY_NAMES[new Date(Date.now() - i * 86400000).getDay()]));
  const total = wall ? wall.posts.length + wall.waiting.length : 0;

  return (
    <View style={{ paddingBottom: 20 }}>
      <View style={st.head}>
        <IconTile icon={challengeIcon(ch)} color={ch.color} size={64} solid />
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
          {win ? <WindowStrip win={win} now={now} /> : null}

          {me.out ? (
            <View style={st.outCard}>
              <Icon name="x" size={22} color="#C0303F" stroke={2.6} />
              <View style={{ flex: 1 }}>
                <Text style={T.h3}>You're out of this challenge</Text>
                <Text style={T.small}>You missed 3 days. Talk to Rabbi Zevy about the next one.</Text>
              </View>
            </View>
          ) : ch.active ? (
            closed && !done ? (
              <View style={st.closedCard}>
                <View style={[st.snapIcon, { backgroundColor: C.line }]}><Icon name={win!.state === 'shabbat' ? 'flame' : win!.state === 'before' ? 'sun' : 'lock'} size={26} color={C.sub} stroke={2} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={st.snapTitle}>{win!.state === 'shabbat' ? 'Shabbat. No tefillin today' : win!.state === 'before' ? `Opens at sunrise, ${nyTime(win!.rise)}` : 'Closed for today'}</Text>
                  <Text style={T.small}>{win!.state === 'before' ? `In ${untilText(win!.rise - now)}. Doesn't count as a miss yet.` : win!.state === 'after' ? `The window ended at sunset, ${nyTime(win!.set)}.` : 'Shabbat never breaks your streak.'}</Text>
                </View>
              </View>
            ) : done ? (
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
                  <Text style={T.small}>{win ? `Open until sunset, ${nyTime(win.set)} · ${untilText(win.set - now)} left` : me.strikes > 0 ? `${me.strikes} of 3 strikes. Don't miss today.` : 'Take a quick photo.'}</Text>
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
              {wallErr ? <Text style={[T.small, { marginTop: 12 }]}>{wallErr}</Text> : !wall ? <BoardSkeleton /> : (
                <>
                <Board wall={wall} onOpen={setOpen} />
                <Text style={[st.section, { marginTop: 26 }]}>Who wrapped</Text>
                <View style={st.grid}>
                  <Card style={{ padding: 0, width: '100%' }}>
                    {wall.posts.map((p, i) => (
                      <Pressable key={p.key} onPress={() => setOpen(p)} style={({ pressed }) => [st.whoRow, i > 0 && st.ruleTop, pressed && { backgroundColor: C.bg }]} accessibilityRole="button" accessibilityLabel={`${p.name}, ${timeOf(p.at)}`}>
                        <Image source={{ uri: p.url }} style={st.whoThumb} />
                        <Text style={[T.h3, { flex: 1 }]} numberOfLines={1}>{p.mine ? 'You' : p.name}</Text>
                        {p.status === 'checked' ? <Icon name="check" size={16} color={C.green} stroke={2.4} /> : null}
                        <Text style={st.whoTime}>{timeOf(p.at)}</Text>
                      </Pressable>
                    ))}
                    {wall.waiting.map((w, i) => (
                      <View key={w.name + i} style={[st.whoRow, (wall.posts.length > 0 || i > 0) && st.ruleTop, { opacity: 0.6 }]} accessibilityLabel={`${w.name}, ${w.out ? 'out' : day === 0 ? 'not yet' : 'missed'}`}>
                        <View style={[st.whoThumb, st.whoEmpty]}><Text style={st.emptyInitial}>{w.name[0]?.toUpperCase()}</Text></View>
                        <Text style={[T.h3, { flex: 1, color: C.sub }]} numberOfLines={1}>{w.mine ? 'You' : w.name}</Text>
                        <Text style={st.whoTime}>{w.out ? 'Out' : day === 0 ? 'Not yet' : 'Missed'}</Text>
                      </View>
                    ))}
                  </Card>
                  {total === 0 ? <Text style={[T.small, { marginTop: 4 }]}>No one has signed up yet.</Text> : null}
                </View>
                </>
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
          <Modal visible={!!pending || !!party} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setPending(null); setParty(null); }}>
            <View style={{ flex: 1, backgroundColor: C.bg }}>
              {party ? <Celebrate ch={ch} count={party.count} streak={party.streak} onClose={() => setParty(null)} /> : (
              <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, maxWidth: 600, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
                <View style={st.sheetHead}>
                  <Text style={[T.h2, { flex: 1 }]}>Today's photo</Text>
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

// The board: 8 small squares across. Photos for those who wrapped, grey squares for those who
// haven't, faint open squares after that. Starts as 8 x 16 and grows when more people sign up.
const COLS = 8;
function Board({ wall, onOpen }: { wall: WallT; onOpen: (p: WallPost) => void }) {
  const filled = wall.posts.length + wall.waiting.length;
  const slots = Math.max(COLS * 16, Math.ceil(filled / COLS) * COLS);
  const cells: React.ReactNode[] = [];
  wall.posts.forEach((p) => cells.push(
    <Pressable key={p.key} onPress={() => onOpen(p)} style={({ pressed }) => [st.cell, pressed && { transform: [{ scale: 0.9 }] }]} accessibilityRole="button" accessibilityLabel={`${p.name}, ${timeOf(p.at)}`}>
      <Image source={{ uri: p.url }} style={u.fill} resizeMode="cover" />
      {p.status === 'checked' ? <View style={st.cellCheck} /> : null}
    </Pressable>,
  ));
  wall.waiting.forEach((w, i) => cells.push(
    <View key={'w' + i} style={[st.cell, st.cellWaiting]} accessibilityLabel={`${w.name}, not yet`}>
      <Text style={st.cellInitial}>{w.name[0]?.toUpperCase()}</Text>
    </View>,
  ));
  for (let i = filled; i < slots; i++) cells.push(<View key={'e' + i} style={[st.cell, st.cellOpen]} />);
  return (
    <View>
      <View style={st.board}>{cells}</View>
      <View style={st.legend}>
        <View style={[st.legendDot, { backgroundColor: C.blue }]} /><Text style={st.legendText}>Wrapped</Text>
        <View style={[st.legendDot, st.cellWaiting]} /><Text style={st.legendText}>Not yet</Text>
        <View style={[st.legendDot, st.cellOpen]} /><Text style={st.legendText}>Open spot</Text>
      </View>
    </View>
  );
}

// Today's wrap window: sunrise to sunset in Great Neck, with a dot for where "now" is.
function WindowStrip({ win, now }: { win: ReturnType<typeof wrapWindow>; now: number }) {
  const pct = Math.max(0, Math.min(1, (now - win.rise) / (win.set - win.rise)));
  const open = win.state === 'open';
  return (
    <View style={st.window} accessibilityLabel={`Tefillin today from ${nyTime(win.rise)} to ${nyTime(win.set)}`}>
      <View style={st.windowEnds}>
        <View style={st.windowEnd}><Icon name="sun" size={15} color={C.sub} stroke={2.2} /><Text style={st.windowTime}>{nyTime(win.rise)}</Text></View>
        <Text style={[st.windowState, open && { color: C.green }]}>{win.state === 'shabbat' ? 'Shabbat' : open ? 'Open now' : win.state === 'before' ? 'Opens soon' : 'Closed'}</Text>
        <View style={st.windowEnd}><Text style={st.windowTime}>{nyTime(win.set)}</Text><Icon name="clock" size={15} color={C.sub} stroke={2.2} /></View>
      </View>
      <View style={st.windowTrack}>
        <View style={[st.windowFill, { width: `${pct * 100}%`, opacity: open ? 1 : 0.35 }]} />
        {open ? <View style={[st.windowNow, { left: `${pct * 100}%` }]} /> : null}
      </View>
      <Text style={st.windowNote}>Sunrise to sunset in Great Neck. Times change every day.</Text>
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
      {[...Array(COLS * 4)].map((_, i) => <View key={i} style={[st.cell, st.cellWaiting]} />)}
    </Animated.View>
  );
}

// After posting: confetti, a check that springs in, the new streak and the next reward.
const CONFETTI = ['#159FDC', '#F5B81F', '#F0569A', '#1FA971', '#7C5CFC', '#F2913D'];
function Celebrate({ ch, count, streak: days, onClose }: { ch: Challenge; count: number; streak: number; onClose: () => void }) {
  const hue = HUES[ch.color] ?? HUES.blue;
  const nd = Platform.OS !== 'web';
  const burst = useRef(new Animated.Value(0)).current;
  const check = useRef(new Animated.Value(0)).current;
  const text = useRef(new Animated.Value(0)).current;
  const bits = useRef([...Array(28)].map((_, i) => ({
    angle: (i / 28) * Math.PI * 2 + Math.random() * 0.4,
    dist: 110 + Math.random() * 90,
    spin: (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 360),
    color: CONFETTI[i % CONFETTI.length],
    w: 6 + Math.random() * 5,
    round: i % 3 === 0,
  }))).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(burst, { toValue: 1, duration: 1300, easing: Easing.out(Easing.cubic), useNativeDriver: nd }),
      Animated.spring(check, { toValue: 1, friction: 5, tension: 120, useNativeDriver: nd }),
      Animated.timing(text, { toValue: 1, duration: 500, delay: 250, useNativeDriver: nd }),
    ]).start();
  }, []);
  const next = ch.rewards.find((r) => r.at > count);
  const goalLeft = Math.max(0, ch.goal - count);
  return (
    <View style={st.party}>
      <View style={st.partyStage}>
        {bits.map((b, i) => (
          <Animated.View key={i} pointerEvents="none" style={{
            position: 'absolute', width: b.w, height: b.round ? b.w : b.w * 1.8, borderRadius: b.round ? b.w : 2, backgroundColor: b.color,
            opacity: burst.interpolate({ inputRange: [0, 0.1, 0.75, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(b.angle) * b.dist] }) },
              { translateY: burst.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, Math.sin(b.angle) * b.dist * 0.8, Math.sin(b.angle) * b.dist + 70] }) },
              { rotate: burst.interpolate({ inputRange: [0, 1], outputRange: ['0deg', b.spin + 'deg'] }) },
            ],
          }} />
        ))}
        <Animated.View style={[st.partyCheck, { backgroundColor: hue.solid, transform: [{ scale: check }] }]}>
          <Icon name="tick" size={54} color={C.white} stroke={3} />
        </Animated.View>
      </View>
      <Animated.View style={{ alignItems: 'center', opacity: text, transform: [{ translateY: text.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
        <Text style={st.partyTitle}>{days > 1 ? `${days} days in a row` : 'You wrapped today'}</Text>
        <Text style={st.partySub}>Your photo is on today's board.</Text>
        <View style={st.partyStats}>
          <View style={st.partyStat}><Text style={st.partyNum}>{count}</Text><Text style={st.partyLabel}>check-ins</Text></View>
          <View style={st.partyDivider} />
          <View style={st.partyStat}><Text style={st.partyNum}>{goalLeft}</Text><Text style={st.partyLabel}>to the goal</Text></View>
        </View>
        {next ? (
          <View style={st.partyNext}>
            <Icon name="gift" size={18} color={hue.deep} stroke={2.2} />
            <Text style={[st.partyNextText, { color: hue.deep }]}>{next.at - count} more for: {next.prize}</Text>
          </View>
        ) : null}
      </Animated.View>
      <View style={{ width: '100%', marginTop: 28 }}>
        <Button label="See today's board" color={hue.solid} onPress={onClose} />
      </View>
    </View>
  );
}

function RuleCard() {
  return (
    <View style={st.rule}>
      <Text style={st.ruleTitle}>The rules</Text>
      <Text style={st.ruleLine}>1. Wrap and snap a photo every day between sunrise and sunset. Shabbat doesn't count.</Text>
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
  const { comment, react } = useStore();
  const [comments, setComments] = useState<WallPost['comments']>([]);
  const [reactions, setReactions] = useState<NonNullable<WallPost['reactions']>>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setComments(post?.comments ?? []); setReactions(post?.reactions ?? []); setText(''); setErr(null); }, [post?.key]);
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
            {post.caption ? <Text style={st.caption}>{post.caption}</Text> : null}
            {post.status === 'checked' ? (
              <View style={st.checkedRow}><Icon name="check" size={16} color={C.green} stroke={2.4} /><Text style={st.checkedText}>Checked by Rabbi Zevy</Text></View>
            ) : null}
            <View style={st.reactRow}>
              {['❤️', '🔥', '💪', '👏', '🙌'].map((e) => {
                const r = reactions.find((x) => x.emoji === e);
                return (
                  <Pressable key={e} onPress={async () => { const next = await react(ch.id, post.key, e); if (next) setReactions(next); }} style={({ pressed }) => [st.reactBtn, r?.mine && st.reactOn, pressed && { transform: [{ scale: 0.92 }] }]} accessibilityRole="button" accessibilityLabel={`React ${e}${r ? `, ${r.count}` : ''}`}>
                    <Text style={st.reactEmoji}>{e}</Text>
                    {r ? <Text style={[st.reactCount, r.mine && { color: C.blueDeep }]}>{r.count}</Text> : null}
                  </Pressable>
                );
              })}
            </View>
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
  party: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, maxWidth: 520, width: '100%', alignSelf: 'center' },
  partyStage: { width: 220, height: 200, alignItems: 'center', justifyContent: 'center' },
  partyCheck: { width: 108, height: 108, borderRadius: 54, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
  partyTitle: { fontSize: 30, fontFamily: F.display, color: C.ink, letterSpacing: -0.6, textAlign: 'center', marginTop: 6 },
  partySub: { fontSize: 15, color: C.sub, marginTop: 6, textAlign: 'center' },
  partyStats: { flexDirection: 'row', alignItems: 'center', marginTop: 22, paddingVertical: 14, paddingHorizontal: 26, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  partyStat: { alignItems: 'center', minWidth: 90 },
  partyNum: { fontSize: 28, fontFamily: F.display, color: C.ink, fontVariant: ['tabular-nums'] },
  partyLabel: { fontSize: 12, fontWeight: '700', color: C.sub, marginTop: 2 },
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
  board: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 14 },
  cell: { width: '11.5%', aspectRatio: 1, borderRadius: 7, overflow: 'hidden', backgroundColor: C.line },
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
