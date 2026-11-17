import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { C, PREFS } from './theme';

// Opening animation (about 2 seconds, tap to skip): the CTeen tile drops in with a glow,
// light rings ripple out, GREAT NECK spells itself in letter by letter, then the whole
// thing lifts away to reveal the app. Off when Settings > Opening animation or Reduce motion is set.
const ND = Platform.OS !== 'web';
const WORD = 'GREAT NECK';

export function Intro() {
  const [done, setDone] = useState(!PREFS.intro || PREFS.reduceMotion);
  const tile = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const letters = useRef([...WORD].map(() => new Animated.Value(0))).current;
  const out = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (done) return;
    const seq = Animated.sequence([
      Animated.spring(tile, { toValue: 1, damping: 11, stiffness: 120, mass: 0.9, useNativeDriver: ND }),
      Animated.parallel([
        Animated.timing(ring, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: ND }),
        Animated.stagger(55, letters.map((l) => Animated.spring(l, { toValue: 1, damping: 12, stiffness: 200, useNativeDriver: ND }))),
      ]),
      Animated.delay(260),
      Animated.timing(out, { toValue: 1, duration: 420, easing: Easing.in(Easing.cubic), useNativeDriver: ND }),
    ]);
    seq.start(({ finished }) => finished && setDone(true));
    const failsafe = setTimeout(() => setDone(true), 4000); // never block the app, even if animations are paused
    return () => { seq.stop(); clearTimeout(failsafe); };
  }, [done]);

  if (done) return null;
  const skip = () => {
    Animated.timing(out, { toValue: 1, duration: 240, useNativeDriver: ND }).start(() => setDone(true));
  };
  // In its own see-through window so it also plays above the first-launch setup.
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={skip}>
    <Animated.View
      style={[StyleSheet.absoluteFill, st.root, { opacity: out.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ scale: out.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={skip} accessibilityRole="button" accessibilityLabel="Skip intro" />
      <View pointerEvents="none" style={st.center}>
        {[0, 1].map((i) => (
          <Animated.View
            key={i}
            style={[st.ring, {
              opacity: ring.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.5 - i * 0.2, 0] }),
              transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.4 + i * 0.8] }) }],
            }]}
          />
        ))}
        <Animated.View style={{
          opacity: tile,
          transform: [
            { translateY: tile.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] }) },
            { scale: tile.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
            { rotate: tile.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '0deg'] }) },
          ],
        }}>
          <View style={st.glow} />
          <Image source={require('../assets/logo.png')} style={st.logo} resizeMode="contain" />
        </Animated.View>
        <View style={st.word}>
          {[...WORD].map((ch, i) => (
            <Animated.Text
              key={i}
              style={[st.letter, {
                opacity: letters[i],
                transform: [{ translateY: letters[i].interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
              }]}>
              {ch === ' ' ? ' ' : ch}
            </Animated.Text>
          ))}
        </View>
      </View>
    </Animated.View>
    </Modal>
  );
}

const st = StyleSheet.create({
  root: { backgroundColor: '#0E86C6', zIndex: 1000 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 3, borderColor: '#ffffff' },
  glow: { position: 'absolute', left: -40, right: -40, top: -40, bottom: -40, borderRadius: 120, backgroundColor: 'rgba(255,255,255,0.18)' },
  logo: { width: 92, height: 162 },
  word: { flexDirection: 'row', marginTop: 28 },
  letter: { color: C.white, fontSize: 22, fontWeight: '900', letterSpacing: 4 },
});
