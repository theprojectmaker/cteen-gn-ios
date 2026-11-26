import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { C, PREFS, R } from './theme';
import { Icon } from './icons';

// The streak flame is Apple's own SF Symbol (the one iOS uses), not a drawing:
// lit = the multicolor flame with a barely-there flicker; lighting up = Apple's bounce-up effect;
// unlit = the grey outline flame. Web falls back to the app's flame icon.
const ND = Platform.OS !== 'web';

export function Fire({ size = 48, lit, ignite, tint }: { size?: number; lit: boolean; ignite?: boolean; tint?: string }) {
  const pop = useRef(new Animated.Value(ignite ? 0 : 1)).current;
  const flicker = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!ignite || !lit) return;
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 80, useNativeDriver: ND }).start();
  }, [ignite, lit]);

  useEffect(() => {
    if (!lit || PREFS.reduceMotion) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(flicker, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }),
      Animated.timing(flicker, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [lit]);

  if (!lit) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <SymbolView name="flame" type="monochrome" tintColor={tint ?? C.faint} size={size * 0.9} weight="regular"
          fallback={<Icon name="flame" size={size * 0.85} color={tint ?? C.faint} stroke={1.8} />} />
      </View>
    );
  }
  return (
    <Animated.View style={{
      width: size, height: size, alignItems: 'center', justifyContent: 'center',
      transform: [
        { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
        { scaleY: flicker.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) },
      ],
      opacity: pop.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
    }}>
      <SymbolView name="flame.fill" type="multicolor" size={size * 0.92} weight="regular"
        animationSpec={ignite ? { effect: { type: 'bounce', direction: 'up', wholeSymbol: true }, repeatCount: 2, speed: 0.8 } : undefined}
        fallback={<Icon name="flame" size={size * 0.85} color={C.orange} fill={C.orangeText} stroke={1.6} />} />
    </Animated.View>
  );
}

// Small flame with the streak number (Home card).
export function FireBadge({ lit, streak, size = 46 }: { lit: boolean; streak: number; size?: number }) {
  return (
    <View style={[st.badge, { width: size, height: size, backgroundColor: lit ? C.orangePale : C.raised }]}>
      <Fire size={size * 0.72} lit={lit} />
      {streak > 0 ? (
        <View style={[st.num, { backgroundColor: lit ? C.orange : C.sub }]}>
          <Text style={st.numText}>{streak}</Text>
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center', borderRadius: R.chip },
  num: { position: 'absolute', bottom: -4, right: -5, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.card },
  numText: { color: C.onOrange, fontSize: 11, fontWeight: '800' },
});
