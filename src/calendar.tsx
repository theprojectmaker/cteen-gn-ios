import React, { useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { C, R, T, display } from './theme';
import { Icon } from './icons';
import { Glass } from './glass';
import { BrushTag, TimeBlock } from './look';
import { countdown, occurrencesInRange, tap, useStore, type EventItem } from './store';

// A live month calendar of everything the chapter has coming up. The rabbi posts events from the
// leader panel (or the dashboard); they show here the moment they save. The day picker is a glass
// lens that springs from day to day like the tab bar, and months slide in with a little bounce.

const ND = Platform.OS !== 'web';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return { y, m: m - 1, d }; };
const todayNY = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
const CELL_H = 50;

export function CalendarScreen() {
  const { content, openEvent, fits } = useStore();
  const events = useMemo(() => content.events.filter(fits), [content.events, fits]);
  const today = todayNY();
  const t0 = parse(today);
  const [cursor, setCursor] = useState({ y: t0.y, m: t0.m });
  const [selected, setSelected] = useState<string>(today);

  // Every day in the visible month that has an event: multi-day events fill their span, and
  // weekly events land on each matching date. Computed over a window around the visible month.
  const byDay = useMemo(() => {
    const map: Record<string, EventItem[]> = {};
    const from = ymd(cursor.y, cursor.m - 1, 1);
    const to = ymd(cursor.y, cursor.m + 2, 0);
    for (const e of events) for (const d of occurrencesInRange(e, from, to)) (map[d] ??= []).push(e);
    return map;
  }, [events, cursor.y, cursor.m]);

  const firstDow = new Date(cursor.y, cursor.m, 1).getDay();
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  // 42 cells (6 weeks). Day-of-month for each, or 0 for padding.
  const cells = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < 42; i++) { const day = i - firstDow + 1; out.push(day >= 1 && day <= daysInMonth ? day : 0); }
    return out;
  }, [firstDow, daysInMonth]);

  const [gridW, setGridW] = useState(0);
  const cellW = gridW ? gridW / 7 : 0;

  // The glass lens springs to the selected day; the month slides+fades when it changes.
  const lensX = useRef(new Animated.Value(0)).current;
  const lensY = useRef(new Animated.Value(0)).current;
  const lensIn = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(0)).current;

  const selIdx = useMemo(() => {
    const s = parse(selected);
    if (s.y !== cursor.y || s.m !== cursor.m) return -1;
    return firstDow + s.d - 1;
  }, [selected, cursor, firstDow]);

  React.useEffect(() => {
    if (selIdx < 0 || !cellW) { Animated.timing(lensIn, { toValue: 0, duration: 140, useNativeDriver: ND }).start(); return; }
    const col = selIdx % 7, row = Math.floor(selIdx / 7);
    Animated.parallel([
      Animated.spring(lensX, { toValue: col * cellW, useNativeDriver: ND, damping: 15, stiffness: 210, mass: 0.8 }),
      Animated.spring(lensY, { toValue: row * CELL_H, useNativeDriver: ND, damping: 15, stiffness: 210, mass: 0.8 }),
      Animated.spring(lensIn, { toValue: 1, useNativeDriver: ND, damping: 12, stiffness: 200 }),
    ]).start();
  }, [selIdx, cellW]);

  const goMonth = (dir: number) => {
    tap();
    slide.setValue(dir * 36);
    Animated.spring(slide, { toValue: 0, useNativeDriver: ND, damping: 13, stiffness: 170 }).start();
    setCursor((c) => {
      const total = c.y * 12 + c.m + dir;
      return { y: Math.floor(total / 12), m: ((total % 12) + 12) % 12 };
    });
  };

  const selEvents = byDay[selected] || [];
  const selDate = parse(selected);
  const selLabel = new Date(selDate.y, selDate.m, selDate.d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const key = selected;
  const monthHasToday = t0.y === cursor.y && t0.m === cursor.m;

  return (
    <>
      <View style={st.head}>
        <View style={{ flex: 1 }}>
          <Text style={T.h1}>Calendar</Text>
          <Text style={st.sub}>Everything coming up at CTeen Great Neck</Text>
        </View>
      </View>

      <Glass style={st.monthBar}>
        <Pressable onPress={() => goMonth(-1)} hitSlop={10} style={st.navBtn} accessibilityRole="button" accessibilityLabel="Previous month">
          <View style={{ transform: [{ scaleX: -1 }] }}><Icon name="right" size={20} color={C.ink} stroke={2.4} /></View>
        </Pressable>
        <Pressable onPress={() => { if (!monthHasToday) { goMonth(t0.y * 12 + t0.m - (cursor.y * 12 + cursor.m)); } setSelected(today); }} style={st.monthLabelWrap} accessibilityRole="button" accessibilityLabel="Jump to today">
          <Text style={st.monthLabel}>{MONTHS[cursor.m]} {cursor.y}</Text>
          {!monthHasToday ? <Text style={st.todayHint}>Today</Text> : null}
        </Pressable>
        <Pressable onPress={() => goMonth(1)} hitSlop={10} style={st.navBtn} accessibilityRole="button" accessibilityLabel="Next month">
          <Icon name="right" size={20} color={C.ink} stroke={2.4} />
        </Pressable>
      </Glass>

      <View style={st.weekRow}>
        {WEEKDAYS.map((w, i) => <Text key={i} style={st.weekLabel}>{w[0]}</Text>)}
      </View>

      <Animated.View style={[st.grid, { opacity: slide.interpolate({ inputRange: [-36, 0, 36], outputRange: [0.3, 1, 0.3] }), transform: [{ translateX: slide }] }]} onLayout={(e) => setGridW(e.nativeEvent.layout.width)}>
        {cellW ? (
          <Animated.View pointerEvents="none" style={[st.lensWrap, { width: cellW, height: CELL_H, transform: [{ translateX: lensX }, { translateY: lensY }, { scale: lensIn.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }], opacity: lensIn }]}>
            <View style={st.lensCircle} />
          </Animated.View>
        ) : null}
        {[0, 1, 2, 3, 4, 5].map((r) => (
          <View key={r} style={st.week}>
            {cells.slice(r * 7, r * 7 + 7).map((day, c) => {
              const i = r * 7 + c;
              if (!day) return <View key={i} style={st.cell} />;
              const key = ymd(cursor.y, cursor.m, day);
              const evs = byDay[key];
              const isToday = key === today;
              const isSel = key === selected;
              return (
                <Pressable key={i} onPress={() => { tap(); setSelected(key); }} style={st.cell} accessibilityRole="button" accessibilityLabel={`${MONTHS[cursor.m]} ${day}${evs ? `, ${evs.length} event${evs.length > 1 ? 's' : ''}` : ''}`}>
                  <View style={[st.dayNumWrap, isToday && !isSel && st.todayRing]}>
                    <Text style={[st.dayNum, isSel && { color: C.onBlue, fontWeight: '800' }, isToday && !isSel && { color: C.orangeText, fontWeight: '800' }]}>{day}</Text>
                  </View>
                  <View style={st.dots}>
                    {(evs || []).slice(0, 3).map((e, n) => <View key={n} style={[st.dot, { backgroundColor: isToday ? C.orange : C.blue }]} />)}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </Animated.View>

      <View style={st.dayHead}>
        {key === today ? <BrushTag label="TODAY" style={st.todayTag} /> : null}
        <Text style={st.dayHeadText} accessibilityRole="header">{selLabel}</Text>
      </View>

      {selEvents.length ? (
        <View>
          {selEvents.map((e, i) => {
            const line = [e.place, e.price].filter(Boolean).join(' · ') || countdown(e);
            return (
              <Pressable key={e.id} onPress={() => openEvent(e.id)} style={({ pressed }) => [st.evRow, i < selEvents.length - 1 && st.evRule, pressed && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel={`${e.title}, ${e.time || 'all day'}, ${line}`}>
                <TimeBlock time={e.time || 'All day'} />
                <View style={{ flex: 1 }}>
                  <Text style={st.evTitle} numberOfLines={2}>{e.title}</Text>
                  <Text style={st.evLine} numberOfLines={2}>{line}</Text>
                </View>
                <Icon name="right" size={16} color={C.faint} stroke={2.4} />
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={st.empty}>
          <Text style={[T.h2, { color: C.sub }]}>Nothing on this day</Text>
          <Text style={st.emptyText}>Tap a day with a dot to see what's on.</Text>
        </View>
      )}
    </>
  );
}

const st = StyleSheet.create({
  head: { marginBottom: 20 },
  sub: { fontSize: 15, lineHeight: 21, color: C.sub, marginTop: 4 },
  monthBar: { flexDirection: 'row', alignItems: 'center', borderRadius: R.input, padding: 4, marginBottom: 14 },
  navBtn: { width: 44, height: 44, borderRadius: R.btnSm, alignItems: 'center', justifyContent: 'center' },
  monthLabelWrap: { flex: 1, alignItems: 'center' },
  monthLabel: { ...display(28) },
  todayHint: { fontSize: 13, lineHeight: 16, fontWeight: '700', color: C.blue, marginTop: 1 },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekLabel: { flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '700', color: C.faint },
  grid: { position: 'relative' },
  week: { flexDirection: 'row' },
  cell: { flex: 1, height: CELL_H, alignItems: 'center', justifyContent: 'center', gap: 3 },
  dayNumWrap: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  todayRing: { borderWidth: 1.5, borderColor: C.orange },
  dayNum: { fontSize: 16, fontWeight: '600', color: C.ink },
  dots: { flexDirection: 'row', gap: 3, height: 5 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  lensWrap: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 5 },
  lensCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.blue },
  dayHead: { marginTop: 24, marginBottom: 8 },
  todayTag: { marginBottom: 14 },
  dayHeadText: { ...display(28) },
  evRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18 },
  evRule: { borderBottomWidth: 1, borderBottomColor: C.line },
  evTitle: { ...display(22) },
  evLine: { fontSize: 15, lineHeight: 21, color: C.sub, marginTop: 3 },
  empty: { paddingTop: 14 },
  emptyText: { fontSize: 15, lineHeight: 21, color: C.sub, marginTop: 6 },
});
