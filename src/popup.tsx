import React, { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { C, R, SH, T } from './theme';
import { Icon } from './icons';
import { useStore } from './store';
import { Label, Slab } from './look';

// The leaders' pop-up: right after the opening animation (and when you come back after 30+ minutes
// away) while a leader has it on. With a poster it "posts" itself: the poster rises up, tilts and
// settles, then the info underneath fades in. Set in the leader panel (Poster or Pop-up).
const ND = Platform.OS !== 'web';
const AWAY_MS = 30 * 60 * 1000;

export function StartupPopup({ ready }: { ready: boolean }) {
  const { content, onboarded, adminOpen, openEvent, openChallenge } = useStore();
  const p = content.popup;
  const { height } = useWindowDimensions();
  const [opens, setOpens] = useState(1);
  const [seen, setSeen] = useState(0);
  const leftAt = useRef(0);
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;
  const info = useRef(new Animated.Value(0)).current;
  const [ratio, setRatio] = useState(0.75); // poster width / height

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') leftAt.current = Date.now();
      if (s === 'active' && leftAt.current && Date.now() - leftAt.current > AWAY_MS) setOpens((n) => n + 1);
    });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!p?.image) return;
    Image.getSize(p.image, (w, h) => h && setRatio(Math.max(0.5, Math.min(1.4, w / h))), () => {});
  }, [p?.image]);

  const show = ready && onboarded && !adminOpen && !!p?.on && !!(p.title || p.image) && seen !== opens;
  useEffect(() => {
    if (!show) return;
    fade.setValue(0); rise.setValue(0); info.setValue(0);
    Animated.sequence([
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: ND }),
      Animated.spring(rise, { toValue: 1, friction: 7, tension: 60, useNativeDriver: ND }),
      Animated.timing(info, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: ND }),
    ]).start();
  }, [show]);

  if (!show || !p) return null;
  const close = (then?: () => void) => {
    Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: ND }).start(() => { setSeen(opens); then?.(); });
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
  const posterH = Math.min(height * 0.52, 520);
  return (
    <Modal visible transparent animationType="none" onRequestClose={() => close()} statusBarTranslucent>
      <Animated.View style={[st.backdrop, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} accessibilityLabel="Close" />
        <ScrollView contentContainerStyle={st.center} showsVerticalScrollIndicator={false} bounces={false}>
          {p.image ? (
            <Animated.View style={{
              opacity: rise,
              transform: [
                { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [height * 0.5, 0] }) },
                { rotate: rise.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '0deg'] }) },
                { scale: rise.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
              ],
            }}>
              <Pressable onPress={go} disabled={!p.target} accessibilityRole={p.target ? 'button' : 'image'} accessibilityLabel={p.title || 'Poster'}>
                <Image source={{ uri: p.image }} style={[st.poster, { height: posterH, width: posterH * ratio }]} resizeMode="cover" />
              </Pressable>
            </Animated.View>
          ) : null}
          <Animated.View style={[st.card, p.image && st.cardUnder, { opacity: p.image ? info : rise, transform: [{ translateY: (p.image ? info : rise).interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
            <Label tone="orange">From Rabbi Zevy</Label>
            {p.title ? <Text style={st.title}>{p.title}</Text> : null}
            {p.body ? <Text style={st.body}>{p.body}</Text> : null}
            {p.more ? <Text style={st.more}>{p.more}</Text> : null}
            <Slab label={p.button || (p.target ? 'Take a look' : 'Got it')} onPress={go} style={st.btn} />
            {p.target ? <Pressable onPress={() => close()} hitSlop={8} style={{ marginTop: 12 }} accessibilityRole="button"><Text style={st.later}>Not now</Text></Pressable> : null}
          </Animated.View>
        </ScrollView>
        <Pressable onPress={() => close()} hitSlop={10} style={st.x} accessibilityRole="button" accessibilityLabel="Close">
          <Icon name="x" size={16} color={C.ink} stroke={2.6} />
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: C.shade },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, paddingTop: 70 },
  poster: { borderRadius: R.print, backgroundColor: C.card, ...SH.print },
  card: { width: '100%', maxWidth: 380, borderRadius: R.sheet, backgroundColor: C.card, padding: 22, alignItems: 'center' },
  cardUnder: { marginTop: 16 },
  title: { ...T.h1, fontSize: 30, lineHeight: 30, textAlign: 'center', marginTop: 8 },
  body: { fontSize: 16, lineHeight: 22, color: C.ink, textAlign: 'center', marginTop: 8 },
  more: { fontSize: 14, lineHeight: 20, color: C.sub, textAlign: 'center', marginTop: 8 },
  btn: { alignSelf: 'stretch', marginTop: 18 },
  later: { fontSize: 14, fontWeight: '600', color: C.sub },
  x: { position: 'absolute', top: 54, right: 18, width: 36, height: 36, borderRadius: 18, backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassLine, alignItems: 'center', justifyContent: 'center' },
});
