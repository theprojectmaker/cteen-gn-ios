import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import { C, F, PREFS } from './theme';

// Opening animation (about 2 seconds, tap to skip). Plain background like a real launch screen:
// the CTeen logo settles in, GREAT NECK rises in letter by letter over a line that draws itself,
// then everything zooms gently toward you and fades to reveal the app.
// A plain overlay (never a second window). Off when Settings > Opening animation or Reduce motion is set.
const ND = Platform.OS !== 'web';
const WORD = 'GREAT NECK';
const ease = Easing.bezier(0.22, 1, 0.36, 1); // smooth "out" curve

export function Intro({ onDone }: { onDone?: () => void }) {
  const [done, setDone] = useState(!PREFS.intro || PREFS.reduceMotion);
  useEffect(() => { if (done) onDone?.(); }, [done]);
  const logo = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const line = useRef(new Animated.Value(0)).current;
  const letters = useRef([...WORD].map(() => new Animated.Value(0))).current;
  const out = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (done) return;
    Animated.timing(drift, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }).start();
    const seq = Animated.sequence([
      Animated.parallel([
        Animated.timing(logo, { toValue: 1, duration: 620, easing: ease, useNativeDriver: ND }),
        Animated.sequence([
          Animated.delay(180),
          Animated.timing(glow, { toValue: 1, duration: 700, easing: ease, useNativeDriver: ND }),
        ]),
      ]),
      Animated.parallel([
        Animated.timing(line, { toValue: 1, duration: 520, easing: ease, useNativeDriver: ND }),
        Animated.stagger(38, letters.map((l) => Animated.timing(l, { toValue: 1, duration: 420, easing: ease, useNativeDriver: ND }))),
      ]),
      Animated.delay(320),
      Animated.timing(out, { toValue: 1, duration: 460, easing: Easing.bezier(0.64, 0, 0.78, 0), useNativeDriver: ND }),
    ]);
    seq.start(({ finished }) => finished && setDone(true));
    const failsafe = setTimeout(() => setDone(true), 4000); // never block the app, even if animations are paused
    return () => { seq.stop(); clearTimeout(failsafe); };
  }, [done]);

  if (done) return null;
  const skip = () => {
    Animated.timing(out, { toValue: 1, duration: 240, useNativeDriver: ND }).start(() => setDone(true));
  };
  return (
    <Animated.View style={[StyleSheet.absoluteFill, st.root, { opacity: out.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.85, 0] }) }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={skip} accessibilityRole="button" accessibilityLabel="Skip intro" />
      <Animated.View pointerEvents="none" style={[st.center, {
        transform: [{ scale: out.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] }) }],
      }]}>
        <View style={st.logoWrap}>
          <Animated.View style={{
            opacity: logo,
            transform: [
              { translateY: logo.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
              { scale: logo.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) },
            ],
          }}>
            <Image source={require('../assets/mark.png')} style={st.logo} resizeMode="contain" />
          </Animated.View>
        </View>
        <View style={st.word}>
          {[...WORD].map((ch, i) => (
            <Animated.Text
              key={i}
              style={[st.letter, {
                opacity: letters[i],
                transform: [{ translateY: letters[i].interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
              }]}>
              {ch === ' ' ? ' ' : ch}
            </Animated.Text>
          ))}
        </View>
        <Animated.View style={[st.line, { opacity: line, transform: [{ scaleX: line }] }]} />
      </Animated.View>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  root: { backgroundColor: C.bg, zIndex: 1000, overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoWrap: { width: 180, height: 190, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 93, height: 120 },
  word: { flexDirection: 'row', marginTop: 18 },
  letter: { color: C.ink, fontSize: 30, lineHeight: 32, fontFamily: F.display, letterSpacing: 3 },
  line: { width: 150, height: 5, borderRadius: 1, backgroundColor: C.orange, marginTop: 12, transform: [{ skewX: '-16deg' }] },
});
