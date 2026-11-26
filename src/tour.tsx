import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { C, R, T } from './theme';
import { Icon } from './icons';
import { useStore } from './store';
import { Label, Slab } from './look';

// A one-time quick tour of the four tabs, shown once after sign-up.
const ND = Platform.OS !== 'web';
const STEPS = [
  { icon: 'home', title: 'Home', text: 'Your day at a glance: the next events, your Tefillin streak and this Shabbat.' },
  { icon: 'ticket', title: 'Events', text: 'Everything coming up. Tap Going to RSVP, add it to your calendar in one tap.' },
  { icon: 'chat', title: 'Feed', text: 'News and photos from Rabbi Zevy. Like, comment and never miss an announcement.' },
  { icon: 'users', title: 'Chapter', text: 'Minyan times, how to reach the Chabad house, and Ask the rabbi anything.' },
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
          <Label style={{ marginBottom: 16 }}>Quick tour · {i + 1} of {STEPS.length}</Label>
          <Animated.View style={{ alignItems: 'center', opacity: step, transform: [{ translateX: step.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
            <Icon name={s.icon} size={34} color={C.blue} stroke={1.9} />
            <Text style={st.title}>{s.title}</Text>
            <Text style={st.text}>{s.text}</Text>
          </Animated.View>
          <View style={st.dots}>{STEPS.map((_, j) => <View key={j} style={[st.dot, j === i && st.dotOn]} />)}</View>
          <Slab label={i === STEPS.length - 1 ? "Let's go" : 'Next'} onPress={next} style={st.btn} />
          {i < STEPS.length - 1 ? <Pressable onPress={markTourSeen} hitSlop={8} style={{ marginTop: 12 }} accessibilityRole="button"><Text style={st.skip}>Skip</Text></Pressable> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: C.shade, alignItems: 'center', justifyContent: 'flex-end', padding: 16, paddingBottom: 40 },
  card: { width: '100%', maxWidth: 400, borderRadius: R.sheet, backgroundColor: C.card, padding: 24, alignItems: 'center' },
  title: { ...T.h1, marginTop: 12 },
  text: { fontSize: 16, lineHeight: 23, color: C.sub, textAlign: 'center', marginTop: 6, minHeight: 46 },
  dots: { flexDirection: 'row', gap: 4, marginTop: 18 },
  dot: { width: 14, height: 5, borderRadius: 1, backgroundColor: C.tick, transform: [{ skewX: '-16deg' }] },
  dotOn: { backgroundColor: C.blue },
  btn: { alignSelf: 'stretch', marginTop: 18 },
  skip: { fontSize: 14, fontWeight: '600', color: C.sub },
});
