import React from 'react';
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
  const m = content.minyan ?? MINYAN_FALLBACK;
  const shab = sh && sh !== 'error' ? sh : null;
  return (
    <View style={st.card}>
      <Section title="Weekdays" rows={m.weekday} sh={shab} />
      <Section title={shab?.parsha ? `Shabbat · ${shab.parsha}` : 'Shabbat'} rows={m.shabbat} sh={shab} top />
      {m.note ? <Text style={st.note}>{m.note}</Text> : null}
      <Pressable onPress={() => open('tel:' + CHAPTER.phone.replace(/[^0-9]/g, ''))} style={({ pressed }) => [st.call, pressed && { opacity: 0.7 }]} accessibilityRole="button">
        <Icon name="phone" size={15} color={C.blue} stroke={2.2} />
        <Text style={st.callText}>Questions? Call {CHAPTER.phone}</Text>
      </Pressable>
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
