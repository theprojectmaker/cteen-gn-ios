import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, PREFS, numeral } from './theme';
import Svg, { Path } from 'react-native-svg';
import { Icon } from './icons';
import { Label, Slab } from './look';
import { MINYAN_FALLBACK, minyanTime } from './minyan';
import { useShabbat, useStore } from './store';
import { isFriday } from './zmanim';

// FRIDAY SIDE TAB. On Fridays (until Shabbat starts, through Shabbat itself, and on Saturday until it
// ends) a small tab sits on the right screen edge with a pulsing candle. Tapping it slides out a
// compact panel with this Shabbat's times; in the last hour before candle lighting the pulse is faster
// and the panel counts down. Tapping outside, or the x, closes it. A Shabbat notification opens it too.

// A drawn candle: the body in ink, the flame in orange (the glow behind the tab pulses with it).
function Candle() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path d="M9 11.500h6V20a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z" stroke={C.ink} strokeWidth={1.9} strokeLinejoin="round" />
      <Path d="M12 11.500V10" stroke={C.ink} strokeWidth={1.9} strokeLinecap="round" />
      <Path d="M12 2.500c1.800 2 2.600 3.300 2.600 4.600a2.600 2.600 0 0 1-5.200 0c0-1.300.800-2.600 2.600-4.600z" fill={C.orange} stroke={C.orange} strokeWidth={1} strokeLinejoin="round" />
    </Svg>
  );
}

const TAB_W = 38, TAB_H = 56, PANEL_W = 262;
const HOUR = 3600000;

const isSaturday = (t: number) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(new Date(t)) === 'Sat';

function until(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

export function ShabbatTab() {
  const { shabbatOpen, setShabbatOpen, go, content } = useStore();
  const sh = useShabbat();
  const win = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const data = sh && sh !== 'error' ? sh : null;
  const candlesAt = data?.candlesAt, havdalahAt = data?.havdalahAt;
  const [now, setNow] = useState(() => Date.now());
  const left = candlesAt ? candlesAt - now : null;
  const lastHour = left !== null && left > 0 && left <= HOUR;
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), lastHour && shabbatOpen ? 1000 : 30000);
    return () => clearInterval(t);
  }, [lastHour, shabbatOpen]);

  // pulse (off with Reduce motion), faster in the last hour
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (PREFS.reduceMotion) { pulse.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: lastHour ? 600 : 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: lastHour ? 600 : 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [lastHour]);

  // the panel slides in from the right edge
  const slide = useRef(new Animated.Value(shabbatOpen ? 0 : 1)).current;
  const [mounted, setMounted] = useState(shabbatOpen);
  useEffect(() => {
    if (shabbatOpen) {
      setMounted(true);
      if (PREFS.reduceMotion) slide.setValue(0); else Animated.spring(slide, { toValue: 0, friction: 9, tension: 70, useNativeDriver: true }).start();
    } else if (mounted) {
      if (PREFS.reduceMotion) { slide.setValue(1); setMounted(false); }
      else Animated.timing(slide, { toValue: 1, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => setMounted(false));
    }
  }, [shabbatOpen]);

  // when it is on screen: every Friday; on Saturday until Shabbat ends
  const show = isFriday(new Date(now)) || (isSaturday(now) && !!havdalahAt && now < havdalahAt);
  if (!show && !shabbatOpen) return null;

  const top = Math.max(insets.top + 90, Math.round(win.height * 0.54) - TAB_H / 2);
  const m = content.minyan ?? MINYAN_FALLBACK;
  const teen = m.shabbat.find((r) => /teen/i.test(r.label));
  const started = left !== null && left <= 0;
  const closeIt = () => setShabbatOpen(false);

  return (
    <>
      {mounted ? (
        <Pressable onPress={closeIt} style={st.scrim} accessibilityRole="button" accessibilityLabel="Close the Shabbat times" />
      ) : null}
      {mounted ? (
        <Animated.View style={[st.panel, { top: top - 20, width: PANEL_W, transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [0, PANEL_W + 20] }) }] }]}>
          <View style={st.head}>
            <Text style={st.headText} numberOfLines={1}>Shabbat{data?.parsha ? ` · ${data.parsha}` : ''}</Text>
            <Pressable onPress={closeIt} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close"><Icon name="x" size={18} color={C.sub} stroke={2.4} /></Pressable>
          </View>
          {data ? (
            <>
              <Text style={st.big} numberOfLines={1}>{data.candles ?? '—'}</Text>
              <Text style={st.label}>Candle lighting</Text>
              {left !== null && left > 0 ? (
                lastHour ? (
                  <Text style={st.count}>{`${String(Math.floor(left / 60000)).padStart(2, '0')}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`} left</Text>
                ) : <Text style={st.count}>in {until(left)}</Text>
              ) : started ? <Text style={st.count}>Shabbat Shalom</Text> : null}
              <View style={st.rule} />
              <View style={st.row}>
                <Text style={st.rowLabel}>Shabbat ends</Text>
                <Text style={st.rowTime}>{data.havdalah ?? '—'}</Text>
              </View>
              {teen ? (
                <View style={st.row}>
                  <Text style={st.rowLabel} numberOfLines={1}>{teen.label}</Text>
                  <Text style={[st.rowTime, { color: C.blue }]}>{teen.time ? minyanTime(teen.time, data).time : ''}</Text>
                </View>
              ) : null}
            </>
          ) : (
            <Text style={st.calm}>{sh === 'error' ? 'The times are not available right now.' : 'Loading this week’s times…'}</Text>
          )}
          <Slab size="md" kind="ghost" label="All times" onPress={() => { closeIt(); go('Chapter'); }} style={{ marginTop: 16 }} accessibilityLabel="All Shabbat and minyan times" />
        </Animated.View>
      ) : null}
      {!shabbatOpen ? (
        <Pressable onPress={() => setShabbatOpen(true)} style={[st.tab, { top }]} accessibilityRole="button" accessibilityLabel="Shabbat times" accessibilityHint="Opens the candle lighting time">
          <Animated.View pointerEvents="none" style={[st.glow, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.8] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }] }]} />
          <Animated.View style={{ transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) }] }}>
            <Candle />
          </Animated.View>
        </Pressable>
      ) : null}
    </>
  );
}

const st = StyleSheet.create({
  tab: { position: 'absolute', right: 0, width: TAB_W, height: TAB_H, zIndex: 30, borderTopLeftRadius: 14, borderBottomLeftRadius: 14, backgroundColor: C.raised, borderWidth: 1, borderRightWidth: 0, borderColor: C.lineStrong, alignItems: 'center', justifyContent: 'center', shadowColor: C.orange, shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
  glow: { position: 'absolute', width: 34, height: 34, borderRadius: 17, backgroundColor: C.orangePale },
  scrim: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 40 },
  panel: { position: 'absolute', right: 0, zIndex: 41, borderTopLeftRadius: 14, borderBottomLeftRadius: 14, backgroundColor: C.raised, borderWidth: 1, borderRightWidth: 0, borderColor: C.lineStrong, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 18, shadowColor: '#000000', shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: -6, height: 10 }, elevation: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  headText: { flex: 1, fontFamily: F.bold, fontSize: 13, lineHeight: 17, letterSpacing: 1.6, color: C.sub, textTransform: 'uppercase' },
  big: { ...numeral(44, C.ink), marginTop: 14 },
  label: { fontSize: 15, lineHeight: 21, color: C.sub, marginTop: 2 },
  count: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: C.orangeText, marginTop: 6 },
  rule: { height: 1, backgroundColor: C.line, marginVertical: 16 },
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  rowLabel: { flex: 1, fontSize: 15, lineHeight: 21, fontWeight: '600', color: C.ink },
  rowTime: { ...numeral(24, C.ink) },
  calm: { fontSize: 15, lineHeight: 21, color: C.sub, marginTop: 14 },
});
