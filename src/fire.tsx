import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { C, IS_DARK, PREFS } from './theme';

// The streak fire. Lit: three flame layers that each flicker on their own rhythm (so it looks alive,
// not like one shape scaling), with a warm glow. Unlit: a grey flame with a faint ember breathing.
// ignite: plays the lighting moment (burst up, flash, sparks rising).
const ND = Platform.OS !== 'web';
const FLAME = 'M12 1.5c1.3 3.6 5.6 6.2 5.6 12.1A5.6 5.6 0 0 1 6.4 13.6c0-2.6 1.2-4.4 2.5-5.7.3 1.7 1.1 2.8 2.3 3.3-.5-3.3-.1-6.5.8-9.7z';

function useLoop(duration: number, delay = 0) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (PREFS.reduceMotion) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }),
      Animated.timing(v, { toValue: 0, duration: duration * 0.9, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }),
    ]));
    const t = setTimeout(() => loop.start(), delay);
    return () => { clearTimeout(t); loop.stop(); };
  }, []);
  return v;
}

// One flame layer that flickers from its base (scaleY pivots at the bottom, a little sway).
let gid = 0;
function Layer({ size, colors, scale, dur, delay, sway }: { size: number; colors: [string, string]; scale: number; dur: number; delay: number; sway: number }) {
  const f = useLoop(dur, delay);
  const id = useRef('fl' + gid++).current;
  const h = size * scale;
  const sy = f.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.08] });
  return (
    <Animated.View style={{
      position: 'absolute', bottom: 0, width: h, height: h, left: (size - h) / 2,
      transform: [
        { translateY: f.interpolate({ inputRange: [0, 1], outputRange: [h * 0.05, -h * 0.04] }) },
        { translateX: f.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-sway, sway, -sway * 0.4] }) },
        { scaleY: sy },
        { scaleX: f.interpolate({ inputRange: [0, 1], outputRange: [1.04, 0.95] }) },
        { rotate: f.interpolate({ inputRange: [0, 1], outputRange: [`${-sway}deg`, `${sway}deg`] }) },
      ],
    }}>
      <Svg width={h} height={h} viewBox="0 0 24 24">
        <Defs><LinearGradient id={id} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={colors[0]} /><Stop offset="1" stopColor={colors[1]} /></LinearGradient></Defs>
        <Path d={FLAME} fill={'url(#' + id + ')'} />
      </Svg>
    </Animated.View>
  );
}

export function Fire({ size = 48, lit, ignite }: { size?: number; lit: boolean; ignite?: boolean }) {
  const glow = useLoop(1400, 100);
  const ember = useLoop(1800);
  const burst = useRef(new Animated.Value(ignite ? 0 : 1)).current;
  const sparks = useRef([...Array(10)].map((_, i) => ({ v: new Animated.Value(0), x: (i - 4.5) * (size / 22) + (Math.random() - 0.5) * size * 0.1, rise: size * (0.7 + Math.random() * 0.6), d: Math.random() * 350 }))).current;

  useEffect(() => {
    if (!ignite || !lit) return;
    burst.setValue(0);
    Animated.spring(burst, { toValue: 1, friction: 4, tension: 70, useNativeDriver: ND }).start();
    Animated.stagger(60, sparks.map((s) => Animated.sequence([Animated.delay(s.d), Animated.timing(s.v, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: ND })]))).start();
  }, [ignite, lit]);

  if (!lit) {
    // unlit: grey flame, warm ember at the base breathing softly
    return (
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox="0 0 24 24" style={StyleSheet.absoluteFill}>
          <Path d={FLAME} fill={IS_DARK ? '#2B3846' : '#DCE3EA'} stroke={IS_DARK ? '#3C4B5C' : '#C5CFD9'} strokeWidth={0.8} />
        </Svg>
        <Animated.View style={{
          position: 'absolute', left: size * 0.36, width: size * 0.28, height: size * 0.28, bottom: size * 0.1, borderRadius: size, backgroundColor: '#FF8A3D',
          opacity: ember.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.55] }),
          transform: [{ scale: ember.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.15] }) }],
        }} />
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size }}>
      {/* warm glow */}
      <Animated.View pointerEvents="none" style={{
        position: 'absolute', left: -size * 0.4, top: -size * 0.25, width: size * 1.8, height: size * 1.8,
        opacity: Animated.multiply(burst, glow.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.85] })),
        transform: [{ scale: burst.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.2, 1.3, 1] }) }],
      }}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Defs><RadialGradient id="fireglow" cx="50" cy="58" r="50" gradientUnits="userSpaceOnUse"><Stop offset="0" stopColor="#FF9A3C" stopOpacity={IS_DARK ? 0.5 : 0.35} /><Stop offset="0.55" stopColor="#FFB86B" stopOpacity={0.12} /><Stop offset="1" stopColor="#FFB86B" stopOpacity={0} /></RadialGradient></Defs>
          <Circle cx="50" cy="58" r="50" fill="url(#fireglow)" />
        </Svg>
      </Animated.View>
      <Animated.View style={{ width: size, height: size, transform: [{ translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [size * 0.35, 0] }) }, { scale: burst.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.1, 1.18, 1] }) }] }}>
        <Layer size={size} colors={['#E8361A', '#FF8A1F']} scale={1} dur={620} delay={0} sway={2.5} />
        <Layer size={size} colors={['#FF6A1A', '#FFB52E']} scale={0.78} dur={480} delay={90} sway={3.5} />
        <Layer size={size} colors={['#FFA62B', '#FFE27A']} scale={0.55} dur={380} delay={40} sway={4} />
        <Layer size={size} colors={['#FFE9A0', '#FFFBEA']} scale={0.3} dur={300} delay={150} sway={3} />
      </Animated.View>
      {/* sparks rising when it lights */}
      {ignite ? sparks.map((s, i) => (
        <Animated.View key={i} pointerEvents="none" style={{
          position: 'absolute', left: size / 2 + s.x - 2, bottom: size * 0.35, width: 4, height: 4, borderRadius: 2, backgroundColor: i % 2 ? '#FFD448' : '#FF7A2A',
          opacity: s.v.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 0.8, 0] }),
          transform: [{ translateY: s.v.interpolate({ inputRange: [0, 1], outputRange: [0, -s.rise] }) }, { translateX: s.v.interpolate({ inputRange: [0, 1], outputRange: [0, s.x * 0.6] }) }],
        }} />
      )) : null}
    </View>
  );
}

// Small fire with the streak number in it (Home card, banner).
export function FireBadge({ lit, streak, size = 46 }: { lit: boolean; streak: number; size?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Fire size={size} lit={lit} />
      {streak > 0 ? (
        <View style={[st.num, { bottom: -2, right: -4, backgroundColor: lit ? '#FF5A1F' : C.sub }]}>
          <Animated.Text style={st.numText}>{streak}</Animated.Text>
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  num: { position: 'absolute', minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.card },
  numText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
});
