import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { C, R, T, F } from './theme';
import { Icon } from './icons';
import { CHAPTER, dateLabel, open, upcoming, useShabbat, useStore } from './store';
import { Button, Card, Cover, Field, IconTile } from './ui';
import { NameGate } from './rewards';
import { MINYAN_FALLBACK, minyanTime } from './minyan';

// ───────────────────────── Chapter ─────────────────────────
// Chapter tab: who runs it, this Shabbat, what's next, how to reach us. Real content, iOS-style lists.
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
  return (
    <>
      <View style={st.pageHead}>
        <Image source={require('../assets/mark.png')} style={st.pageLogo} resizeMode="contain" />
        <View style={{ flex: 1 }}>
          <Text style={st.pageTitle}>{CHAPTER.name}</Text>
          <Text style={st.pageSub}>{CHAPTER.org} · 400 East Shore Road</Text>
        </View>
      </View>

      {/* this Shabbat: the Teen Minyan front and center */}
      <View style={st.shabCard}>
        <View style={st.shabTop}>
          <Text style={st.shabEyebrow}>This Shabbat{shab?.parsha ? ` · ${shab.parsha}` : ''}</Text>
          <Text style={st.shabWhen}>{toShabbat === 0 ? 'Today' : toShabbat === 1 ? 'Tomorrow' : `In ${toShabbat} days`}</Text>
        </View>
        <View style={st.shabMain}>
          <View style={{ flex: 1 }}>
            <Text style={st.shabTitle}>{teen?.label ?? 'Teen Minyan'}</Text>
            <Text style={st.shabSub}>Shabbat morning at the Chabad house</Text>
          </View>
          <Text style={st.shabTime}>{teen?.time ? minyanTime(teen.time, shab).time : '10:00 AM'}</Text>
        </View>
        <View style={st.shabRow}>
          <View style={st.shabCell}><Text style={st.shabCellLabel}>Candle lighting</Text><Text style={st.shabCellValue}>{clock(shab?.candlesAt) || '—'}</Text></View>
          <View style={st.shabDivider} />
          <View style={st.shabCell}><Text style={st.shabCellLabel}>Shabbat ends</Text><Text style={st.shabCellValue}>{clock(shab?.havdalahAt) || '—'}</Text></View>
        </View>
      </View>

      {/* the people who run it */}
      <View style={st.rabbiCard}>
        <View style={st.avatars}>
          <View style={[st.avatar, { backgroundColor: C.blue }]}><Text style={st.avatarText}>Z</Text></View>
          <View style={[st.avatar, st.avatar2, { backgroundColor: C.orange }]}><Text style={st.avatarText}>S</Text></View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.rabbiName}>Rabbi Zevy & Shani</Text>
          <Text style={st.rabbiSub}>Run CTeen Great Neck</Text>
        </View>
        <Pressable onPress={() => open('tel:' + CHAPTER.phone.replace(/\D/g, ''))} style={({ pressed }) => [st.pillBtn, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel="Call"><Icon name="phone" size={16} color={C.blue} stroke={2.2} /></Pressable>
        <Pressable onPress={() => setAskOpen((n) => n + 1)} style={({ pressed }) => [st.pillBtn, st.pillAsk, pressed && { opacity: 0.85 }]} accessibilityRole="button"><Text style={st.pillAskText}>Ask</Text></Pressable>
      </View>
      <AskRabbi openSignal={askOpen} />

      {next ? (
        <>
          <GroupLabel text="Next at the Chabad house" />
          <Pressable onPress={() => openEvent(next.id)} style={({ pressed }) => [st.nextCard, pressed && { opacity: 0.9 }]} accessibilityRole="button" accessibilityLabel={next.title}>
            <Cover e={next} style={st.nextImg} iconSize={28} />
            <View style={{ flex: 1 }}>
              <Text style={st.nextTitle} numberOfLines={2}>{next.title}</Text>
              <Text style={st.gSub}>{dateLabel(next)}{next.time ? ` · ${next.time}` : ''}</Text>
            </View>
            <Icon name="right" size={14} color={C.faint} stroke={2.4} />
          </Pressable>
        </>
      ) : null}

      <GroupLabel text="Visit and reach us" />
      <View style={st.group}>
        <GRow icon="pin" tile="#FF4D4F" title="Directions" sub={CHAPTER.address} onPress={() => open('https://maps.apple.com/?q=' + encodeURIComponent(CHAPTER.org + ', ' + CHAPTER.address))} chevron="right" first />
        <GRow icon="phone" tile="#34C759" title="Call the Chabad house" value={CHAPTER.phone} onPress={() => open('tel:' + CHAPTER.phone.replace(/\D/g, ''))} />
        <GRow icon="camera" tile="#E1306C" title="Instagram" value={CHAPTER.instagramHandle} onPress={() => open(CHAPTER.instagram)} />
        <GRow icon="clock" tile="#5856D6" title="Shul schedule" sub="Shacharit, Mincha, Maariv" onPress={() => setShulOpen((o) => !o)} chevron={shulOpen ? 'down' : 'right'} />
        {shulOpen ? (
          <View style={st.shul}>
            {[...shul.weekday.map((r) => ({ ...r, day: 'Weekdays' })), ...shul.shabbat.map((r) => ({ ...r, day: 'Shabbat' }))].map((r, i) => {
              const t = r.time ? minyanTime(r.time, shab) : null;
              return (
                <View key={r.label + i} style={st.shulRow}>
                  <Text style={st.shulLabel}>{r.label}<Text style={st.shulDay}>  {r.day}</Text></Text>
                  <Text style={[st.shulTime, !t && { color: C.faint, fontWeight: '600' }]}>{t ? t.time : 'Call for times'}</Text>
                </View>
              );
            })}
            {m.note ? <Text style={st.shulNote}>{m.note}</Text> : null}
          </View>
        ) : null}
      </View>

      {content.info.length ? (
        <>
          <GroupLabel text="About CTeen" />
          <View style={st.group}>
            {content.info.map((i, n) => <InfoRow key={i.id} icon={i.icon} title={i.title} body={i.body} first={n === 0} />)}
          </View>
        </>
      ) : null}

      <GroupLabel text="More" />
      <View style={st.group}>
        <GRow icon="users" tile="#1877F2" title="Facebook" onPress={() => open(CHAPTER.facebook)} chevron="right" first />
        <GRow icon="globe" tile={C.blue} title="CTeen portal" sub="International events, service hours" onPress={() => open(CHAPTER.portal)} chevron="right" />
        <GRow icon="external" tile="#8E8E93" title="Chapter sign-up" onPress={() => open(CHAPTER.join)} chevron="right" />
        <GRow icon="gift" tile={C.orange} title="Donate" onPress={() => open(CHAPTER.donate)} chevron="right" />
      </View>

      <Pressable onPress={() => setAdminOpen(true)} style={st.leaderLink} hitSlop={8} accessibilityRole="button">
        <Text style={[st.leaderText, { color: C.faint, fontWeight: '600' }]}>{leader ? 'Open leader panel' : 'Leader sign-in'}</Text>
      </Pressable>
      {online === false ? <Text style={st.endNote}>Offline: showing the last saved info</Text> : null}
    </>
  );
}

function GroupLabel({ text }: { text: string }) {
  return <Text style={st.groupLabel}>{text}</Text>;
}

// One row in a grouped list: a small colored icon square (like iOS Settings), title + subtitle, value or chevron.
function GRow({ icon, tile, title, sub, value, onPress, chevron, first }: { icon?: string; tile?: string; title: string; sub?: string; value?: string; onPress?: () => void; chevron?: 'right' | 'down'; first?: boolean }) {
  const body = (
    <>
      <View style={[st.gBody, !first && st.gRule]}>
        <View style={{ flex: 1 }}>
          <Text style={st.gTitle}>{title}</Text>
          {sub ? <Text style={st.gSub} numberOfLines={1}>{sub}</Text> : null}
        </View>
        {value ? <Text style={st.gValue}>{value}</Text> : null}
        {chevron ? <View style={{ transform: [{ rotate: chevron === 'down' ? '90deg' : '0deg' }] }}><Icon name="right" size={14} color={C.faint} stroke={2.4} /></View> : null}
      </View>
    </>
  );
  if (!onPress) return <View style={st.gRow}>{body}</View>;
  return <Pressable onPress={onPress} style={({ pressed }) => [st.gRow, pressed && { backgroundColor: C.bg }]} accessibilityRole="button">{body}</Pressable>;
}

// A "Good to know" item: just the title until you tap it.
function InfoRow({ icon, title, body, first }: { icon: string; title: string; body: string; first?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable onPress={() => setOpen((o) => !o)} style={({ pressed }) => [st.gRow, { alignItems: 'flex-start' }, pressed && { backgroundColor: C.bg }]} accessibilityRole="button" accessibilityState={{ expanded: open }}>
      <View style={[st.gBody, !first && st.gRule, { alignItems: 'flex-start' }]}>
        <View style={{ flex: 1 }}>
          <Text style={st.gTitle}>{title}</Text>
          <Text style={[st.gSub, { lineHeight: 19, marginTop: 4 }]} numberOfLines={open ? undefined : 1}>{body}</Text>
        </View>
        <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }], marginTop: 3 }}><Icon name="right" size={14} color={C.faint} stroke={2.4} /></View>
      </View>
    </Pressable>
  );
}

function MoreRow({ icon, title, url, first }: { icon: string; title: string; url: string; first?: boolean }) {
  return (
    <Pressable onPress={() => open(url)} style={({ pressed }) => [st.chInfoRow, { alignItems: 'center' }, !first && st.rule, pressed && { backgroundColor: C.bg }]} accessibilityRole="link">
      <Icon name={icon} size={19} color={C.sub} stroke={2} />
      <Text style={[st.chInfoTitle, { flex: 1 }]}>{title}</Text>
      <Icon name="right" size={16} color={C.faint} stroke={2.4} />
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
    <>
      <Text style={st.homeSection}>Ask the rabbi</Text>
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
  pageHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2, marginBottom: 18 },
  pageLogo: { width: 31, height: 40 },
  pageTitle: { fontSize: 27, fontFamily: F.display, color: C.ink, letterSpacing: -0.6 },
  pageSub: { fontSize: 14, color: C.sub, marginTop: 1 },
  shabCard: { borderRadius: 22, backgroundColor: C.card, padding: 18, shadowColor: '#0F1D2B', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  shabTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shabEyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: C.orange },
  shabWhen: { fontSize: 12, fontWeight: '800', color: C.orange, backgroundColor: C.orangePale, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  shabMain: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  shabTitle: { fontSize: 22, fontFamily: F.display, color: C.ink, letterSpacing: -0.3 },
  shabSub: { fontSize: 13, color: C.sub, marginTop: 2 },
  shabTime: { fontSize: 26, fontFamily: F.display, color: C.ink, fontVariant: ['tabular-nums'] },
  shabRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  shabCell: { flex: 1 },
  shabCellLabel: { fontSize: 12, color: C.sub, fontWeight: '600' },
  shabCellValue: { fontSize: 17, fontWeight: '800', color: C.ink, marginTop: 2, fontVariant: ['tabular-nums'] },
  shabDivider: { width: StyleSheet.hairlineWidth, height: 32, backgroundColor: C.line, marginHorizontal: 14 },
  rabbiCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, padding: 14, borderRadius: 22, backgroundColor: C.card },
  avatars: { flexDirection: 'row', width: 62 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.card },
  avatarText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  avatar2: { marginLeft: -14 },
  rabbiName: { fontSize: 16, fontWeight: '800', color: C.ink },
  rabbiSub: { fontSize: 13, color: C.sub, marginTop: 1 },
  pillBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.bluePale, alignItems: 'center', justifyContent: 'center' },
  pillAsk: { width: undefined, paddingHorizontal: 16, backgroundColor: C.blue },
  pillAskText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  nextCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, paddingRight: 14, borderRadius: 18, backgroundColor: C.card },
  nextImg: { width: 64, height: 64, borderRadius: 12 },
  nextTitle: { fontSize: 16, fontWeight: '800', color: C.ink },
  gSub: { fontSize: 13, color: C.sub, marginTop: 1 },
  group: { borderRadius: 18, backgroundColor: C.card, overflow: 'hidden' },
  shul: { paddingHorizontal: 16, paddingBottom: 12, marginLeft: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, paddingLeft: 0, paddingTop: 6 },
  shulRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 6, gap: 10 },
  shulLabel: { flex: 1, fontSize: 14, color: C.ink },
  shulDay: { fontSize: 12, color: C.faint },
  shulTime: { fontSize: 14, color: C.ink, fontWeight: '700', fontVariant: ['tabular-nums'] },
  shulNote: { fontSize: 12, lineHeight: 17, color: C.sub, marginTop: 8 },
  leaderLink: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'center', marginTop: 28, paddingHorizontal: 16, paddingVertical: 10, borderRadius: R.pill, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  leaderText: { fontSize: 14, fontWeight: '700', color: C.ink },
  endNote: { textAlign: 'center', color: C.faint, fontSize: 13, marginTop: 14, lineHeight: 19 },
  groupLabel: { fontSize: 13, fontWeight: '600', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 28, marginBottom: 8, marginLeft: 16 },
  gBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingRight: 14, minHeight: 52 },
  gRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  gTitle: { fontSize: 16, color: C.ink },
  gValue: { fontSize: 16, color: C.sub, fontVariant: ['tabular-nums'] },
  gRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16 },
  chInfoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  rule: { borderTopWidth: 1, borderTopColor: C.line },
  chInfoTitle: { fontSize: 15, fontWeight: '800', color: C.ink },
  homeSection: { fontSize: 20, fontFamily: F.display, color: C.ink, letterSpacing: -0.3, marginTop: 32, marginBottom: 12 },
  askRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  err: { color: '#C0303F', fontWeight: '700', fontSize: 13, marginTop: 8, textAlign: 'center' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
});
