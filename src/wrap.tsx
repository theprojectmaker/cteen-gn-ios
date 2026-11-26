import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { C, PREFS, numeral } from './theme';
import { Icon } from './icons';
import { doneThisPeriod, useStore } from './store';
import { nyTime, wrapWindow, type WrapWindow } from './zmanim';
import { Band, Label } from './look';

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
  const { content, joined, checks, gender } = useStore();
  const ch = gender === 'girl' ? undefined : content.challenges.find((c) => c.id === 'tefillin' && c.active);
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
export function Pulse({ on, color = C.blue, radius = 11, children, style }: { on: boolean; color?: string; radius?: number; children: React.ReactNode; style?: ViewStyle }) {
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

// The live banner in the last hour before sunset (Fridays: before candle lighting, then Shabbat):
// a solid orange band with the countdown in big slanted numerals. Tap it to open the challenge.
export function WrapBanner() {
  const w = useWrapStatus();
  if (!w || !w.lastHour) return null;
  const friday = !!w.win.friday;
  return (
    <View style={st.wrap} accessibilityLiveRegion="polite">
      <Band tone="orange" onPress={() => router.push(`/challenge/${w.id}`)}
        accessibilityLabel={`${friday ? 'Wrap tefillin before Shabbat' : 'Last hour to wrap tefillin'}, ${leftText(w.left)} left`}>
        <View style={st.row}>
          <Text style={st.timer}>{leftText(w.left)}</Text>
          <View style={st.text}>
            <Label tone="onOrange" size={13}>{friday ? 'Left to wrap before Shabbat' : 'Left to wrap today'}</Label>
            <Text style={st.sub}>{friday ? `Candle lighting at ${nyTime(w.win.set)}. Wrap, snap, then get ready for Shabbat.` : `Closes at sunset, ${nyTime(w.win.set)}. ${w.mine ? 'Snap your selfie now.' : 'Join and wrap today.'}`}</Text>
          </View>
          <Icon name="right" size={18} color={C.onOrange} stroke={2.6} />
        </View>
      </Band>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { marginBottom: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timer: { ...numeral(46, C.onOrange), minWidth: 104 },
  text: { flex: 1 },
  sub: { fontSize: 13, lineHeight: 17, fontWeight: '500', color: C.onOrange, marginTop: 3 },
});
