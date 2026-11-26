import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { C, F, R, SP, T, display, numeral } from './theme';
import { Icon } from './icons';
import { CHAPTER, dateLabel, open, upcoming, useShabbat, useStore } from './store';
import { Card, Cover, Field } from './ui';
import { Band, Hairline, Label, Slab } from './look';
import { NameGate } from './rewards';
import { MINYAN_FALLBACK, minyanTime } from './minyan';

// ───────────────────────── Chapter ─────────────────────────
// Chapter tab: who runs it, this Shabbat, what's next, how to reach us. Flat rows with hairlines,
// one condensed heading per section, readable system text under it, and room between sections.

const GAP = 40;

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
  // days until Shabbat morning (0 on Shabbat). Get the NY weekday by name — parsing a
  // toLocaleString() back into a Date returns Invalid Date on Hermes/JSC (→ "NaN days").
  const dowName = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(new Date());
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(dowName);
  const toShabbat = dow < 0 ? 0 : (6 - dow + 7) % 7;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const fmtDate = (d: string) => { try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); } catch { return d; } };
  const specials = (m.overrides ?? []).filter((o) => o.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 2);
  const board = [...shul.weekday.map((r) => ({ ...r, day: 'Weekdays' })), ...shul.shabbat.map((r) => ({ ...r, day: 'Shabbat' }))];
  return (
    <>
      <View style={st.pageHead}>
        <Image source={require('../assets/mark.png')} style={st.pageLogo} resizeMode="contain" />
        <View style={{ flex: 1 }}>
          <Text style={st.pageTitle} numberOfLines={2}>{CHAPTER.name}</Text>
          <Text style={st.pageSub}>{CHAPTER.org} · 400 East Shore Road</Text>
        </View>
      </View>

      {/* this Shabbat: the same compact band as Home, with the Teen Minyan under the two times */}
      <Band style={st.shabbat}>
        <View style={st.shabTop}>
          <Text style={st.shabHead} numberOfLines={1}>This Shabbat{shab?.parsha ? ` · ${shab.parsha}` : ''}</Text>
          <Text style={st.shabWhen}>{toShabbat === 0 ? 'Today' : toShabbat === 1 ? 'Tomorrow' : `In ${toShabbat} days`}</Text>
        </View>
        <View style={st.shabTimes}>
          <View style={st.shabCol}>
            <Text style={st.shabTime} numberOfLines={1}>{clock(shab?.candlesAt) || '—'}</Text>
            <Text style={st.shabLabel}>Candle lighting</Text>
          </View>
          <Hairline strong vertical />
          <View style={[st.shabCol, { paddingLeft: SP.gutter }]}>
            <Text style={st.shabTime} numberOfLines={1}>{clock(shab?.havdalahAt) || '—'}</Text>
            <Text style={st.shabLabel}>Shabbat ends</Text>
          </View>
        </View>
        <View style={st.shabTeen}>
          <View style={{ flex: 1 }}>
            <Text style={st.shabTeenName} numberOfLines={1}>{teen?.label ?? 'Teen Minyan'}</Text>
            <Text style={st.shabLabel}>Shabbat morning at the Chabad house</Text>
          </View>
          <Text style={st.shabTeenTime}>{teen?.time ? minyanTime(teen.time, shab).time : '10:00 AM'}</Text>
        </View>
      </Band>

      {/* the people who run it */}
      <View style={st.people}>
        <View style={st.peopleTop}>
          <View style={st.avatars}>
            <View style={[st.avatar, { backgroundColor: C.blue }]}><Text style={st.avatarText}>Z</Text></View>
            <View style={[st.avatar, st.avatar2, { backgroundColor: C.orange }]}><Text style={st.avatarText}>S</Text></View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.rowTitle}>Rabbi Zevy & Shani</Text>
            <Text style={st.rowSub}>Run CTeen Great Neck</Text>
          </View>
        </View>
        <View style={st.peopleBtns}>
          <Slab size="md" kind="ghost" icon="phone" label="Call" style={{ flex: 1 }} onPress={() => open('tel:' + CHAPTER.phone.replace(/D/g, ''))} accessibilityLabel="Call" />
          <Slab size="md" label="Ask" style={{ flex: 1 }} onPress={() => setAskOpen((n) => n + 1)} accessibilityLabel="Ask the rabbi a question" />
        </View>
      </View>
      <AskRabbi openSignal={askOpen} />

      {next ? (
        <View style={st.section}>
          <Head title="Next at the Chabad house" />
          <Pressable onPress={() => openEvent(next.id)} style={({ pressed }) => [st.next, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel={next.title}>
            <Cover e={next} style={st.nextImg} iconSize={28} />
            <View style={{ flex: 1 }}>
              <Text style={st.nextTitle} numberOfLines={2}>{next.title}</Text>
              <Text style={st.rowSub}>{dateLabel(next)}{next.time ? ` · ${next.time}` : ''}</Text>
            </View>
            <Icon name="right" size={16} color={C.faint} stroke={2.4} />
          </Pressable>
        </View>
      ) : null}

      <View style={st.section}>
        <Head title="Visit and reach us" />
        <LRow title="Directions" sub={CHAPTER.address} onPress={() => open('https://maps.apple.com/?q=' + encodeURIComponent(CHAPTER.org + ', ' + CHAPTER.address))} chevron="right" />
        <LRow title="Call the Chabad house" value={CHAPTER.phone} onPress={() => open('tel:' + CHAPTER.phone.replace(/\D/g, ''))} />
        <LRow title="Instagram" value={CHAPTER.instagramHandle} onPress={() => open(CHAPTER.instagram)} />
        <LRow title="Shul schedule" sub="Shacharit, Mincha, Maariv" onPress={() => setShulOpen((o) => !o)} chevron={shulOpen ? 'down' : 'right'} last={!shulOpen} />
        {shulOpen ? (
          <View style={st.board} accessibilityLabel="Minyan times">
            {board.map((r, i) => {
              const t = r.time ? minyanTime(r.time, shab) : null;
              return (
                <View key={r.label + i} style={[st.boardRow, i < board.length - 1 && st.rule]}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.boardLabel}>{r.label}</Text>
                    <Text style={st.rowSub}>{r.day}</Text>
                  </View>
                  <Text style={[st.boardTime, !t && st.boardCall]} numberOfLines={1}>{t ? t.time : 'Call for times'}</Text>
                </View>
              );
            })}
            {specials.map((o, i) => (
              <View key={o.date + i} style={[st.boardRow, st.ruleTop]}>
                <View style={{ flex: 1 }}>
                  <Text style={st.boardLabel}>{fmtDate(o.date)}</Text>
                  <Text style={st.rowSub}>Special time</Text>
                </View>
              </View>
            ))}
            {m.note ? <Text style={st.boardNote}>{m.note}</Text> : null}
          </View>
        ) : null}
      </View>

      {content.info.length ? (
        <View style={st.section}>
          <Head title="About CTeen" />
          {content.info.map((i, n) => <InfoRow key={i.id} title={i.title} body={i.body} last={n === content.info.length - 1} />)}
        </View>
      ) : null}

      <View style={st.section}>
        <Head title="More" />
        <LRow title="Facebook" onPress={() => open(CHAPTER.facebook)} chevron="right" />
        <LRow title="CTeen portal" sub="International events, service hours" onPress={() => open(CHAPTER.portal)} chevron="right" />
        <LRow title="Chapter sign-up" onPress={() => open(CHAPTER.join)} chevron="right" />
        <LRow title="Donate" onPress={() => open(CHAPTER.donate)} chevron="right" last />
      </View>

      <Slab kind="ghost" label={leader ? 'Open leader panel' : 'Leader sign-in'} onPress={() => setAdminOpen(true)} style={st.leaderBtn} accessibilityLabel={leader ? 'Open leader panel' : 'Leader sign-in'} />
      {online === false ? <Text style={st.endNote}>Offline: showing the last saved info</Text> : null}
    </>
  );
}

function Head({ title }: { title: string }) {
  return <Text style={st.head} accessibilityRole="header">{title}</Text>;
}

// One row of a list: a title, one line under it, a value or a chevron at the right, a hairline below.
function LRow({ title, sub, value, onPress, chevron, last }: { title: string; sub?: string; value?: string; onPress?: () => void; chevron?: 'right' | 'down'; last?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.lrow, !last && st.rule, pressed && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel={value ? `${title}, ${value}` : title}>
      <View style={{ flex: 1 }}>
        <Text style={st.rowTitle}>{title}</Text>
        {sub ? <Text style={st.rowSub} numberOfLines={2}>{sub}</Text> : null}
      </View>
      {value ? <Text style={st.value}>{value}</Text> : null}
      {chevron ? <View style={{ transform: [{ rotate: chevron === 'down' ? '90deg' : '0deg' }] }}><Icon name="right" size={16} color={C.faint} stroke={2.4} /></View> : null}
    </Pressable>
  );
}

// A "Good to know" item: its title and two lines until you tap it.
function InfoRow({ title, body, last }: { title: string; body: string; last?: boolean }) {
  const [on, setOn] = useState(false);
  return (
    <Pressable onPress={() => setOn((o) => !o)} style={({ pressed }) => [st.lrow, { alignItems: 'flex-start' }, !last && st.rule, pressed && { opacity: 0.6 }]} accessibilityRole="button" accessibilityState={{ expanded: on }}>
      <View style={{ flex: 1 }}>
        <Text style={st.rowTitle}>{title}</Text>
        <Text style={[st.rowSub, { lineHeight: 21 }]} numberOfLines={on ? undefined : 2}>{body}</Text>
      </View>
      <View style={{ transform: [{ rotate: on ? '90deg' : '0deg' }], marginTop: 4 }}><Icon name="right" size={16} color={C.faint} stroke={2.4} /></View>
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
    <View style={st.section}>
      <Head title="Ask the rabbi" />
      {needName ? <Card><NameGate title="Who's asking?" onDone={() => setNeedName(false)} /></Card> : !openForm ? (
        <Text style={st.sent}>{note}</Text>
      ) : (
        <Card>
          <Field label="Your question" value={text} onChange={setText} multiline placeholder="Anything about Judaism, life or CTeen. It goes straight to Rabbi Zevy." />
          {note ? <Text style={st.err}>{note}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Slab kind="ghost" label="Cancel" onPress={() => setOpenForm(false)} style={{ flex: 1 }} />
            <Slab label={busy ? 'Sending…' : 'Send'} icon="send" disabled={busy || text.trim().length < 3} onPress={send} style={{ flex: 1 }} />
          </View>
        </Card>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  pageHead: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 2, marginBottom: 28 },
  pageLogo: { width: 36, height: 46 },
  pageTitle: { ...display(32) },
  pageSub: { fontSize: 15, lineHeight: 21, color: C.sub, marginTop: 3 },
  section: { marginTop: GAP },
  head: { ...display(28), marginBottom: 6 },
  shabbat: { paddingVertical: 20 },
  shabTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  shabHead: { flex: 1, fontFamily: F.bold, fontSize: 14, lineHeight: 18, letterSpacing: 1.6, color: C.sub, textTransform: 'uppercase' },
  shabWhen: { fontSize: 14, lineHeight: 18, fontWeight: '700', color: C.orangeText },
  shabTimes: { flexDirection: 'row', alignItems: 'stretch', marginTop: 14 },
  shabCol: { flex: 1 },
  shabTime: { ...numeral(36), color: C.ink },
  shabLabel: { fontSize: 14, lineHeight: 19, color: C.sub, marginTop: 4 },
  shabTeen: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.line },
  shabTeenName: { fontSize: 17, lineHeight: 22, fontWeight: '600', color: C.ink },
  shabTeenTime: { ...numeral(36, C.blue) },
  people: { marginTop: GAP },
  peopleTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  peopleBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  avatars: { flexDirection: 'row', width: 62 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.bg },
  avatarText: { color: C.onBlue, fontSize: 16, fontWeight: '800' },
  avatar2: { marginLeft: -16 },
  rowTitle: { fontSize: 17, lineHeight: 22, fontWeight: '600', color: C.ink },
  rowSub: { fontSize: 15, lineHeight: 21, color: C.sub, marginTop: 2 },
  next: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  nextImg: { width: 64, height: 64, borderRadius: R.print },
  nextTitle: { ...display(22) },
  lrow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, minHeight: 56 },
  rule: { borderBottomWidth: 1, borderBottomColor: C.line },
  ruleTop: { borderTopWidth: 1, borderTopColor: C.line },
  value: { fontSize: 16, fontWeight: '600', color: C.blue, fontVariant: ['tabular-nums'] },
  board: { marginTop: 4, paddingBottom: 8 },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  boardLabel: { fontSize: 17, lineHeight: 22, fontWeight: '600', color: C.ink },
  boardTime: { ...display(24), flexShrink: 0 },
  boardCall: { fontSize: 15, color: C.faint },
  boardNote: { fontSize: 15, lineHeight: 21, color: C.sub, marginTop: 8 },
  leaderBtn: { alignSelf: 'center', marginTop: GAP, paddingHorizontal: 28 },
  endNote: { textAlign: 'center', color: C.faint, fontSize: 14, marginTop: 16, lineHeight: 20 },
  sent: { fontSize: 15, lineHeight: 21, color: C.sub, marginTop: 8 },
  err: { color: C.red, fontWeight: '700', fontSize: 14, marginTop: 8, textAlign: 'center' },
});
