import React, { useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { C, F, R, T, HUES } from './theme';
import { Icon } from './icons';
import { Glass } from './glass';
import { Cover } from './ui';
import { countdown, dateLabel, tap, useStore, type EventItem } from './store';

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

  // Every day in the visible month that has an event (multi-day events fill their whole span).
  const byDay = useMemo(() => {
    const map: Record<string, EventItem[]> = {};
    for (const e of events) {
      const s = parse(e.start), en = parse(e.end || e.start);
      const d = new Date(s.y, s.m, s.d), end = new Date(en.y, en.m, en.d);
      for (let i = 0; i < 400 && d <= end; i++) { (map[ymd(d.getFullYear(), d.getMonth(), d.getDate())] ??= []).push(e); d.setDate(d.getDate() + 1); }
    }
    return map;
  }, [events]);

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
  const monthHasToday = t0.y === cursor.y && t0.m === cursor.m;

  return (
    <>
      <View style={st.head}>
        <View style={{ flex: 1 }}>
          <Text style={T.h1}>Calendar</Text>
          <Text style={[T.small, { marginTop: 4 }]}>Everything coming up at CTeen Great Neck</Text>
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
          <Animated.View pointerEvents="none" style={[st.lensWrap, { width: cellW, height: CELL_H, transform: [{ translateX: lensX }, { translateY: lensY }, { scale: lensIn.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }], opacity: lensIn }]}>
            <Glass style={st.lens}><View style={st.lensShine} /></Glass>
          </Animated.View>
        ) : null}
        {cells.map((day, i) => {
          if (!day) return <View key={i} style={st.cell} />;
          const key = ymd(cursor.y, cursor.m, day);
          const evs = byDay[key];
          const isToday = key === today;
          const isSel = key === selected;
          return (
            <Pressable key={i} onPress={() => { tap(); setSelected(key); }} style={st.cell} accessibilityRole="button" accessibilityLabel={`${MONTHS[cursor.m]} ${day}${evs ? `, ${evs.length} event${evs.length > 1 ? 's' : ''}` : ''}`}>
              <View style={[st.dayNumWrap, isToday && !isSel && st.todayRing]}>
                <Text style={[st.dayNum, isSel && { color: C.blueDeep, fontWeight: '800' }, isToday && !isSel && { color: C.blue, fontWeight: '800' }]}>{day}</Text>
              </View>
              <View style={st.dots}>
                {(evs || []).slice(0, 3).map((e, n) => <View key={n} style={[st.dot, { backgroundColor: (HUES[e.color] ?? HUES.blue).solid }]} />)}
              </View>
            </Pressable>
          );
        })}
      </Animated.View>

      <View style={st.dayHead}>
        <Text style={st.dayHeadText}>{selLabel}</Text>
        {selEvents.length ? <Text style={st.dayCount}>{selEvents.length} event{selEvents.length > 1 ? 's' : ''}</Text> : null}
      </View>

      {selEvents.length ? (
        <View style={{ gap: 10 }}>
          {selEvents.map((e) => (
            <Pressable key={e.id} onPress={() => openEvent(e.id)} style={({ pressed }) => [st.evRow, pressed && { backgroundColor: C.bg, transform: [{ scale: 0.99 }] }]} accessibilityRole="button" accessibilityLabel={e.title}>
              <Cover e={e} style={st.evThumb} iconSize={26} />
              <View style={{ flex: 1 }}>
                <Text style={T.h3} numberOfLines={1}>{e.title}</Text>
                <Text style={[T.small, { marginTop: 2 }]} numberOfLines={1}>{dateLabel(e)}{e.time ? ` · ${e.time}` : ''}{e.place ? ` · ${e.place}` : ''}</Text>
                <Text style={[st.evCount, { marginTop: 2 }]}>{countdown(e)}</Text>
              </View>
              <Icon name="right" size={18} color={C.faint} stroke={2.4} />
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={st.empty}>
          <Icon name="calendar" size={26} color={C.faint} stroke={1.8} />
          <Text style={st.emptyText}>Nothing on this day. Tap a day with a dot to see what's on.</Text>
        </View>
      )}
    </>
  );
}

const st = StyleSheet.create({
  head: { marginBottom: 14 },
  monthBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 22, padding: 6, marginBottom: 14 },
  navBtn: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  monthLabelWrap: { flex: 1, alignItems: 'center' },
  monthLabel: { fontSize: 18, fontFamily: F.display, color: C.ink, letterSpacing: -0.4 },
  todayHint: { fontSize: 11, fontWeight: '800', color: C.blue, letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 1 },
  weekRow: { flexDirection: 'row', paddingHorizontal: 2, marginBottom: 4 },
  weekLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '800', color: C.faint },
  grid: { flexDirection: 'row', flexWrap: 'wrap', position: 'relative' },
  cell: { width: `${100 / 7}%`, height: CELL_H, alignItems: 'center', justifyContent: 'center', gap: 3 },
  dayNumWrap: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  todayRing: { borderWidth: 2, borderColor: C.blue },
  dayNum: { fontSize: 16, fontWeight: '600', color: C.ink },
  dots: { flexDirection: 'row', gap: 3, height: 5 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  lensWrap: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center', paddingVertical: 5 },
  lens: { flex: 1, alignSelf: 'stretch', marginHorizontal: 8, borderRadius: 16, overflow: 'hidden', backgroundColor: C.bluePale },
  lensShine: { position: 'absolute', left: 6, right: 6, top: 3, height: '40%', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.45)' },
  dayHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 22, marginBottom: 12 },
  dayHeadText: { fontSize: 18, fontFamily: F.display, color: C.ink, letterSpacing: -0.3, flex: 1 },
  dayCount: { fontSize: 13, fontWeight: '800', color: C.blue },
  evRow: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.card, borderRadius: 18, padding: 12, borderWidth: 1, borderColor: C.line },
  evThumb: { width: 54, height: 54, borderRadius: 14, overflow: 'hidden' },
  evCount: { fontSize: 12, fontWeight: '700', color: C.blueDeep },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 30, paddingHorizontal: 30 },
  emptyText: { fontSize: 14, color: C.faint, textAlign: 'center', lineHeight: 20 },
});
