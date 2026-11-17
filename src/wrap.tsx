import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { C, F, PREFS } from './theme';
import { Icon } from './icons';
import { doneThisPeriod, useStore } from './store';
import { nyTime, wrapWindow, type WrapWindow } from './zmanim';
import { Fire } from './fire';

// Everything about "have you wrapped today, and how long is left": the live last-hour banner,
// the countdown text, and a gentle pulse for things that want a tap.
const ND = Platform.OS !== 'web';

export type WrapStatus = {
  id: string; title: string; mine: boolean; done: boolean; win: WrapWindow; now: number;
  left: number;      // ms until the window closes (0 when closed)
  needed: boolean;   // open now and you haven't posted today
  lastHour: boolean; // needed and under an hour left
};

export function useWrapStatus(): WrapStatus | null {
  const { content, joined, checks } = useStore();
  const ch = content.challenges.find((c) => c.id === 'tefillin' && c.active);
  const [now, setNow] = useState(Date.now());
  const win = wrapWindow(now);
  const left = win.state === 'open' ? Math.max(0, win.set - now) : 0;
  const fast = win.state === 'open' && left < 3600 * 1000;
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), fast ? 1000 : 30000);
    return () => clearInterval(t);
  }, [fast]);
  if (!ch) return null;
  const mine = joined.includes(ch.id);
  const done = mine && doneThisPeriod(ch, checks);
  const needed = win.state === 'open' && !done;
  return { id: ch.id, title: ch.title, mine, done, win, now, left, needed, lastHour: needed && left > 0 && left <= 3600 * 1000 };
}

// "3h 12m" far out, "42:07" in the last hour
export function leftText(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// A soft glow that breathes behind its child (off with Reduce motion).
export function Pulse({ on, color = '#159FDC', radius = 22, children, style }: { on: boolean; color?: string; radius?: number; children: React.ReactNode; style?: ViewStyle }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!on || PREFS.reduceMotion) { a.stopAnimation(); a.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 1300, easing: Easing.out(Easing.quad), useNativeDriver: ND }),
      Animated.delay(400),
    ]));
    loop.start();
    return () => loop.stop();
  }, [on]);
  return (
    <View style={style}>
      {on ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {
          borderRadius: radius, borderWidth: 2, borderColor: color,
          opacity: a.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.8, 0] }),
          transform: [{ scaleX: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) }, { scaleY: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }],
        }]} />
      ) : null}
      {children}
    </View>
  );
}

// The live banner in the last hour before sunset (Fridays: before candle lighting, then Shabbat).
export function WrapBanner() {
  const w = useWrapStatus();
  if (!w || !w.lastHour) return null;
  const friday = !!w.win.friday;
  return (
    <View style={{ marginBottom: 18 }}>
      <Pressable onPress={() => router.push(`/challenge/${w.id}`)} style={({ pressed }) => [st.banner, friday && st.bannerFri, pressed && { opacity: 0.92 }]} accessibilityRole="button" accessibilityLiveRegion="polite"
        accessibilityLabel={`${friday ? 'Wrap tefillin before Shabbat' : 'Last hour to wrap tefillin'}, ${leftText(w.left)} left`}>
        <View style={st.icon}><Fire size={30} lit={false} /></View>
        <View style={{ flex: 1 }}>
          <Text style={st.title}>{friday ? 'Wrap before Shabbat' : 'Last hour to wrap'}</Text>
          <Text style={st.sub}>{friday ? `Candle lighting at ${nyTime(w.win.set)}. Wrap, snap, then get ready for Shabbat.` : `Closes at sunset, ${nyTime(w.win.set)}. ${w.mine ? 'Snap your selfie now.' : 'Join and wrap today.'}`}</Text>
        </View>
        <Text style={st.timer}>{leftText(w.left)}</Text>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 22, backgroundColor: '#E8742A' },
  bannerFri: { backgroundColor: '#5A3FA8' },
  icon: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '900', color: '#FFFFFF' },
  sub: { fontSize: 13, lineHeight: 17, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  timer: { fontSize: 22, fontFamily: F.display, color: '#FFFFFF', fontVariant: ['tabular-nums'], minWidth: 64, textAlign: 'right' },
});
