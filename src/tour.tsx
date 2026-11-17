import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { C, F, IS_DARK } from './theme';
import { Icon } from './icons';
import { useStore } from './store';

// A one-time quick tour of the four tabs, shown once after sign-up.
const ND = Platform.OS !== 'web';
const STEPS = [
  { icon: 'home', color: '#159FDC', title: 'Home', text: 'Your day at a glance: the next events, your Tefillin streak and this Shabbat.' },
  { icon: 'ticket', color: '#F2913D', title: 'Events', text: 'Everything coming up. Tap Going to RSVP, add it to your calendar in one tap.' },
  { icon: 'chat', color: '#1FA971', title: 'Feed', text: 'News and photos from Rabbi Zevy. Like, comment and never miss an announcement.' },
  { icon: 'users', color: '#7C5CFC', title: 'Chapter', text: 'Minyan times, how to reach the Chabad house, and Ask the rabbi anything.' },
];

export function Tour() {
  const { tourSeen, markTourSeen } = useStore();
  const [i, setI] = useState(0);
  const a = useRef(new Animated.Value(0)).current;
  const step = useRef(new Animated.Value(1)).current;
  useEffect(() => { Animated.spring(a, { toValue: 1, friction: 8, tension: 80, useNativeDriver: ND }).start(); }, []);
  if (tourSeen) return null;
  const s = STEPS[i];
  const next = () => {
    if (i === STEPS.length - 1) return markTourSeen();
    step.setValue(0);
    setI(i + 1);
    Animated.timing(step, { toValue: 1, duration: 220, useNativeDriver: ND }).start();
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={markTourSeen} statusBarTranslucent>
      <View style={st.backdrop}>
        <Animated.View style={[st.card, { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }]}>
          <Text style={st.eyebrow}>Quick tour · {i + 1} of {STEPS.length}</Text>
          <Animated.View style={{ alignItems: 'center', opacity: step, transform: [{ translateX: step.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
            <View style={[st.icon, { backgroundColor: s.color }]}><Icon name={s.icon} size={30} color="#FFFFFF" stroke={2} /></View>
            <Text style={st.title}>{s.title}</Text>
            <Text style={st.text}>{s.text}</Text>
          </Animated.View>
          <View style={st.dots}>{STEPS.map((_, j) => <View key={j} style={[st.dot, j === i && { width: 18, backgroundColor: s.color }]} />)}</View>
          <Pressable onPress={next} style={({ pressed }) => [st.btn, { backgroundColor: s.color }, pressed && { opacity: 0.9 }]} accessibilityRole="button">
            <Text style={st.btnText}>{i === STEPS.length - 1 ? "Let's go" : 'Next'}</Text>
          </Pressable>
          {i < STEPS.length - 1 ? <Pressable onPress={markTourSeen} hitSlop={8} style={{ marginTop: 12 }} accessibilityRole="button"><Text style={st.skip}>Skip</Text></Pressable> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: IS_DARK ? 'rgba(0,0,0,0.65)' : 'rgba(10,22,36,0.5)', alignItems: 'center', justifyContent: 'flex-end', padding: 16, paddingBottom: 40 },
  card: { width: '100%', maxWidth: 400, borderRadius: 28, backgroundColor: C.card, padding: 24, alignItems: 'center' },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 0.9, textTransform: 'uppercase', color: C.sub, marginBottom: 16 },
  icon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontFamily: F.display, color: C.ink, marginTop: 14 },
  text: { fontSize: 16, lineHeight: 23, color: C.sub, textAlign: 'center', marginTop: 6, minHeight: 46 },
  dots: { flexDirection: 'row', gap: 6, marginTop: 18 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.line },
  btn: { alignSelf: 'stretch', height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  btnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  skip: { fontSize: 15, fontWeight: '700', color: C.sub },
});
