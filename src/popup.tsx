import React, { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { C, F, IS_DARK } from './theme';
import { Icon } from './icons';
import { useStore } from './store';

// The leaders' startup pop-up: a card that shows every time the app is opened (and when you come
// back after 30+ minutes away) while a leader has it turned on. Set in the leader panel.
const ND = Platform.OS !== 'web';
const AWAY_MS = 30 * 60 * 1000;

export function StartupPopup({ ready }: { ready: boolean }) {
  const { content, onboarded, adminOpen, openEvent, openChallenge } = useStore();
  const p = content.popup;
  const [opens, setOpens] = useState(1); // counts app opens this session
  const [seen, setSeen] = useState(0);   // the open we last showed it for
  const leftAt = useRef(0);
  const a = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') leftAt.current = Date.now();
      if (s === 'active' && leftAt.current && Date.now() - leftAt.current > AWAY_MS) setOpens((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  const show = ready && onboarded && !adminOpen && !!p?.on && !!p.title && seen !== opens;
  useEffect(() => {
    if (!show) return;
    a.setValue(0);
    Animated.spring(a, { toValue: 1, friction: 8, tension: 90, useNativeDriver: ND }).start();
  }, [show]);

  if (!show || !p) return null;
  const close = (then?: () => void) => {
    Animated.timing(a, { toValue: 0, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: ND }).start(() => { setSeen(opens); then?.(); });
  };
  const go = () => {
    const t = p.target;
    close(() => {
      if (!t) return;
      if (t.type === 'event') openEvent(t.id);
      else if (t.type === 'challenge') openChallenge(t.id);
      else router.push(`/post/${t.id}`);
    });
  };
  return (
    <Modal visible transparent animationType="none" onRequestClose={() => close()} statusBarTranslucent>
      <Animated.View style={[st.backdrop, { opacity: a }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} accessibilityLabel="Close" />
        <Animated.View style={[st.card, { opacity: a, transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }, { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
          <View style={st.badge}><Icon name="megaphone" size={22} color={C.white} stroke={2.1} /></View>
          <Text style={st.eyebrow}>From Rabbi Zevy</Text>
          <Text style={st.title}>{p.title}</Text>
          {p.body ? <Text style={st.body}>{p.body}</Text> : null}
          <Pressable onPress={go} style={({ pressed }) => [st.btn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]} accessibilityRole="button">
            <Text style={st.btnText}>{p.button || (p.target ? 'Take a look' : 'Got it')}</Text>
          </Pressable>
          {p.target ? (
            <Pressable onPress={() => close()} hitSlop={8} style={{ marginTop: 12 }} accessibilityRole="button"><Text style={st.later}>Not now</Text></Pressable>
          ) : null}
          <Pressable onPress={() => close()} hitSlop={10} style={st.x} accessibilityRole="button" accessibilityLabel="Close">
            <Icon name="x" size={16} color={C.sub} stroke={2.4} />
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: IS_DARK ? 'rgba(0,0,0,0.6)' : 'rgba(10,22,36,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 380, borderRadius: 28, backgroundColor: C.card, padding: 24, paddingTop: 28, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 30, shadowOffset: { width: 0, height: 14 } },
  badge: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: C.sub, marginTop: 14 },
  title: { fontSize: 24, lineHeight: 29, fontFamily: F.display, color: C.ink, textAlign: 'center', marginTop: 6, letterSpacing: -0.4 },
  body: { fontSize: 16, lineHeight: 23, color: C.ink, textAlign: 'center', marginTop: 10 },
  btn: { alignSelf: 'stretch', height: 52, borderRadius: 26, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  btnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  later: { fontSize: 15, fontWeight: '700', color: C.sub },
  x: { position: 'absolute', top: 14, right: 14, width: 32, height: 32, borderRadius: 16, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
});
