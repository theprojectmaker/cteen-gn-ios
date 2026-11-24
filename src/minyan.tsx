import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C, F } from './theme';
import { Icon } from './icons';
import { CHAPTER, open, useShabbat, useStore, type Minyan, type MinyanRow } from './store';

// Minyan times at Chabad of Great Neck (Chapter tab). Leaders edit them in the leader panel.
// "Candle lighting" and "N min after Shabbat ends" turn into this week's real times.
// Starting times are from chabadgn.com (Daily Prayer Services), checked Nov 16, 2026.
export const MINYAN_FALLBACK: Minyan = {
  weekday: [
    { label: 'Shacharit, Sunday', time: '7:30 AM & 9:00 AM' },
    { label: 'Shacharit, Monday to Friday', time: '7:00 AM & 9:00 AM' },
    { label: 'Mincha & Maariv', time: '' },
  ],
  shabbat: [
    { label: 'Teen Minyan', time: '10:00 AM' },
    { label: 'Friday night', time: 'Candle lighting' },
    { label: 'Shabbat morning', time: '9:25 AM' },
    { label: 'Mincha', time: '' },
    { label: 'Maariv', time: '10 min after Shabbat ends' },
  ],
  note: 'A short 5 to 7 minute class follows the morning minyan. Shabbat morning has a junior congregation and Kiddush after services.',
};

const clock = (ms: number) => new Date(ms).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });

// Turn the stored text into what to show: real times for candle lighting / after Shabbat.
export function minyanTime(t: string, sh: { candlesAt?: number; havdalahAt?: number } | null) {
  const v = t.trim();
  if (v === '@candles' || /candle/i.test(v)) return sh?.candlesAt ? { time: clock(sh.candlesAt), sub: 'Candle lighting' } : { time: 'Candle lighting', sub: '' };
  const after = /^@havdalah\+(\d+)$/.exec(v) || /(\d+)\s*min[a-z]*\s+after/i.exec(v);
  if (after || /after shabbat|shabbat ends/i.test(v)) {
    const mins = after ? Number(after[1]) : 0;
    return sh?.havdalahAt ? { time: clock(sh.havdalahAt + mins * 60000), sub: mins ? `${mins} min after Shabbat ends` : 'When Shabbat ends' } : { time: v.replace(/^@havdalah\+(\d+)$/, '$1 min after Shabbat ends'), sub: '' };
  }
  return { time: v, sub: '' };
}

export function MinyanCard() {
  const { content } = useStore();
  const sh = useShabbat();
  const [more, setMore] = useState(false);
  const m = content.minyan ?? MINYAN_FALLBACK;
  const shab = sh && sh !== 'error' ? sh : null;
  // The Teen Minyan is the one for this app: any row named "Teen ..." becomes the big card on top.
  const isTeen = (r: MinyanRow) => /teen/i.test(r.label);
  const teen = m.shabbat.find(isTeen) ?? m.weekday.find(isTeen);
  const teenDay = teen && m.shabbat.includes(teen) ? 'Shabbat morning' : 'Weekdays';
  const t = teen?.time ? minyanTime(teen.time, shab) : null;
  // Special one-off times the rabbi set for specific upcoming dates (seasonal changes, holidays).
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const fmtDate = (d: string) => { try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); } catch { return d; } };
  const specials = (m.overrides ?? []).filter((o) => o.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 2);
  return (
    <View>
      {teen ? (
        <View style={st.teen}>
          <View style={st.teenIcon}><Icon name="book" size={24} color="#FFFFFF" stroke={2} /></View>
          <View style={{ flex: 1 }}>
            <Text style={st.teenEyebrow}>{teenDay}{shab?.parsha && teenDay === 'Shabbat morning' ? ` · ${shab.parsha}` : ''}</Text>
            <Text style={st.teenTitle}>{teen.label}</Text>
            <Text style={st.teenWhere}>{CHAPTER.org}</Text>
          </View>
          <Text style={st.teenTime}>{t ? t.time : 'Ask'}</Text>
        </View>
      ) : null}
      {specials.map((o) => (
        <View key={o.date} style={[st.special, teen && { marginTop: 12 }]}>
          <Text style={st.specialEyebrow}>{(o.title || 'Special times').toUpperCase()} · {fmtDate(o.date)}</Text>
          {o.rows.map((r, i) => {
            const rt = r.time ? minyanTime(r.time, shab) : null;
            return (
              <View key={r.label + i} style={st.specialRow}>
                <Text style={st.specialLabel}>{r.label}</Text>
                <Text style={st.specialTime}>{rt ? rt.time : 'Call for times'}</Text>
              </View>
            );
          })}
        </View>
      ))}
      <View style={[st.card, (teen || specials.length > 0) && { marginTop: 12 }]}>
        {teen && !more ? (
          <Pressable onPress={() => setMore(true)} style={({ pressed }) => [st.moreRow, pressed && { opacity: 0.7 }]} accessibilityRole="button">
            <Text style={st.moreText}>Show the full shul schedule</Text>
            <Icon name="right" size={16} color={C.blue} stroke={2.4} />
          </Pressable>
        ) : (
          <>
            {m.sunday && m.sunday.length ? <Section title="Sunday" rows={m.sunday.filter((r) => r !== teen)} sh={shab} /> : null}
            <Section title="Weekdays" rows={m.weekday.filter((r) => r !== teen)} sh={shab} top={!!(m.sunday && m.sunday.length)} />
            <Section title={shab?.parsha ? `Shabbat · ${shab.parsha}` : 'Shabbat'} rows={m.shabbat.filter((r) => r !== teen)} sh={shab} top />
            {m.note ? <Text style={st.note}>{m.note}</Text> : null}
          </>
        )}
        <Pressable onPress={() => open('tel:' + CHAPTER.phone.replace(/[^0-9]/g, ''))} style={({ pressed }) => [st.call, pressed && { opacity: 0.7 }]} accessibilityRole="button">
          <Icon name="phone" size={15} color={C.blue} stroke={2.2} />
          <Text style={st.callText}>Questions? Call {CHAPTER.phone}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Section({ title, rows, sh, top }: { title: string; rows: MinyanRow[]; sh: { candlesAt?: number; havdalahAt?: number } | null; top?: boolean }) {
  return (
    <View style={top && st.sectionTop}>
      <Text style={st.section}>{title}</Text>
      {rows.map((r, i) => {
        const t = r.time ? minyanTime(r.time, sh) : null;
        return (
          <View key={r.label + i} style={st.row}>
            <Text style={st.label}>{r.label}</Text>
            <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
              <Text style={[st.time, !t && st.timeMissing]}>{t ? t.time : 'Call for times'}</Text>
              {t?.sub ? <Text style={st.sub}>{t.sub}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  teen: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 24, backgroundColor: C.blue },
  teenIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  teenEyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' },
  teenTitle: { fontSize: 20, fontFamily: F.display, color: '#FFFFFF', marginTop: 2 },
  teenWhere: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  teenTime: { fontSize: 24, fontFamily: F.display, color: '#FFFFFF' },
  special: { padding: 16, borderRadius: 22, backgroundColor: C.orangePale, borderWidth: 1, borderColor: C.orange },
  specialEyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, color: C.orangeDeep, marginBottom: 6 },
  specialRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 4 },
  specialLabel: { fontSize: 15, fontWeight: '700', color: C.ink, flex: 1 },
  specialTime: { fontSize: 15, fontFamily: F.display, color: C.ink, textAlign: 'right' },
  moreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  moreText: { fontSize: 15, fontWeight: '800', color: C.blue },
  card: { padding: 16, borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  section: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: C.sub, marginBottom: 4 },
  sectionTop: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 8 },
  label: { fontSize: 15, fontWeight: '700', color: C.ink, flex: 1 },
  time: { fontSize: 15, fontFamily: F.display, color: C.ink, textAlign: 'right' },
  timeMissing: { fontFamily: undefined, fontWeight: '600', color: C.faint, fontSize: 14 },
  sub: { fontSize: 11, color: C.faint, marginTop: 1 },
  note: { fontSize: 13, lineHeight: 18, color: C.sub, marginTop: 12 },
  call: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  callText: { fontSize: 14, fontWeight: '800', color: C.blue },
});
