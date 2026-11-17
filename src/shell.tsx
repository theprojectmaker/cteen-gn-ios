import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import * as Updates from 'expo-updates';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { C } from './theme';
import { Icon } from './icons';
import { Glass, LIQUID } from './glass';
import { CHAPTER, doneThisPeriod, open, useStore, type Alert } from './store';

// Over-the-air updates: every push to main publishes one. The app checks when it opens or comes
// back to the front, downloads quietly, and switches to it the next time it is opened.
export function useOtaUpdates() {
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    let ready = false;
    let busy = false;
    const check = async () => {
      if (ready) { Updates.reloadAsync().catch(() => {}); return; }
      if (busy) return;
      busy = true;
      try {
        const r = await Updates.checkForUpdateAsync();
        if (r.isAvailable) ready = (await Updates.fetchUpdateAsync()).isNew;
      } catch { /* offline: try again next time */ }
      busy = false;
    };
    check();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') check(); });
    return () => sub.remove();
  }, []);
}

// One tab's page: content scrolls under a floating glass header. The system tab bar
// (Liquid Glass on iOS 26) floats over the bottom; the safe-area inset already includes it.
export function Screen({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { refresh, liveAlert } = useStore();
  const [topH, setTopH] = useState(insets.top + 70);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  return (
    <View style={st.root}>
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingTop: topH + 14, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 110 : 32) }}
        showsVerticalScrollIndicator={false}>
        <View style={st.col}>
          {children}
          <Footer />
        </View>
      </ScrollView>
      <View style={[st.top, { paddingTop: insets.top + 8 }]} onLayout={(e) => setTopH(e.nativeEvent.layout.height)} pointerEvents="box-none">
        <View style={st.col} pointerEvents="box-none">
          <View style={st.headerRow}>
            <Glass style={st.brand}>
              <Image source={require('../assets/logo.png')} style={st.logo} resizeMode="contain" />
              <View>
                <Text style={st.topEyebrow}>CTEEN</Text>
                <Text style={st.topName}>Great Neck</Text>
              </View>
            </Glass>
            <HeaderButtons />
          </View>
          {/* On iOS 26 the live banner lives in the tab bar's accessory instead. */}
          {liveAlert && !LIQUID ? <TopAlert alert={liveAlert} /> : null}
        </View>
      </View>
    </View>
  );
}

// Top-right: a pulsing trophy that opens the Tefillin Challenge (with a one-time tip under it)
// and your account, in one glass capsule like iOS 26 toolbars. Events live in the tab bar.
function HeaderButtons() {
  const { content, name, checks, joined, tipSeen, hideTip } = useStore();
  const live = content.challenges.filter((c) => c.active);
  const main = live.find((c) => c.id === 'tefillin') ?? live[0];
  const due = !!main && (!joined.includes(main.id) || !doneThisPeriod(main, checks));
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!due) { pulse.stopAnimation(); pulse.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
      Animated.delay(500),
    ]));
    pulse.setValue(0);
    loop.start();
    return () => loop.stop();
  }, [due]);
  useEffect(() => {
    if (!main || tipSeen) return;
    const timer = setTimeout(hideTip, 9000);
    return () => clearTimeout(timer);
  }, [main?.id, tipSeen]);
  const openIt = () => { hideTip(); if (main) router.push(`/challenge/${main.id}`); };
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.55, 0] });
  const iconScale = pulse.interpolate({ inputRange: [0, 0.25, 0.5, 1], outputRange: [1, 1.14, 1, 1] });
  return (
    <View>
      <Glass style={st.hGroup} interactive>
        {main ? (
          <Pressable onPress={openIt} style={({ pressed }) => [st.hBtn, pressed && { opacity: 0.55 }]} hitSlop={4} accessibilityRole="button" accessibilityLabel={main.title}>
            {due ? <Animated.View pointerEvents="none" style={[st.ring, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]} /> : null}
            <Animated.View style={{ transform: [{ scale: iconScale }] }}>
              <Icon name="trophy" size={22} color={due ? '#C7841F' : C.ink} stroke={2.1} />
            </Animated.View>
            {due ? <View style={st.hDot} /> : null}
          </Pressable>
        ) : null}
        <Pressable onPress={() => router.push('/account')} style={({ pressed }) => [st.hAvatar, pressed && { opacity: 0.6 }]} hitSlop={4} accessibilityRole="button" accessibilityLabel="Your account">
          {name ? <Text style={st.hAvatarText}>{name[0].toUpperCase()}</Text> : <Icon name="user" size={17} color={C.white} stroke={2.2} />}
        </Pressable>
      </Glass>
      {main && !tipSeen ? (
        <Pressable onPress={openIt} style={st.tip} accessibilityRole="button" accessibilityLabel={`New: ${main.title}`}>
          <View style={st.tipArrow} />
          <Text style={st.tipText}>{main.title}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// Bottom of every page: the shortcuts, then the chapter's name and address.
function Footer() {
  const { go } = useStore();
  const links = [
    { icon: 'ticket', label: 'Events', onPress: () => go('Events') },
    { icon: 'chat', label: 'Feed', onPress: () => go('Feed') },
    { icon: 'camera', label: 'Instagram', onPress: () => open(CHAPTER.instagram) },
    { icon: 'heart', label: 'Hours', onPress: () => open('https://myportal.cteen.com/service') },
  ];
  return (
    <View style={st.footer}>
      <View style={st.footRule} />
      <View style={st.footRow}>
        {links.map((l) => (
          <Pressable key={l.label} onPress={l.onPress} style={({ pressed }) => [st.footLink, pressed && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel={l.label}>
            <View style={st.footIcon}><Icon name={l.icon} size={20} color={C.blueDeep} stroke={2} /></View>
            <Text style={st.footLabel}>{l.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={st.footName}>{CHAPTER.name}</Text>
      <Text style={st.footSmall}>{CHAPTER.org} · 400 East Shore Road</Text>
    </View>
  );
}

function TopAlert({ alert }: { alert: Alert }) {
  const { dismissAlert, openTarget } = useStore();
  return (
    <Glass style={st.alert}>
      <Pressable style={st.alertMain} onPress={() => openTarget(alert.target)} disabled={!alert.target} accessibilityRole={alert.target ? 'button' : 'text'} accessibilityLabel={`${alert.title}. ${alert.text}`}>
        <View style={st.liveDot} />
        <View style={{ flex: 1 }}>
          <Text style={st.alertTitle} numberOfLines={2}>{alert.title}</Text>
          {alert.text ? <Text style={st.alertText} numberOfLines={2}>{alert.text}</Text> : null}
        </View>
        {alert.target ? <Icon name="right" size={16} color={C.ink} stroke={2.4} /> : null}
      </Pressable>
      <Pressable onPress={dismissAlert} hitSlop={10} style={st.alertClose} accessibilityRole="button" accessibilityLabel="Dismiss banner">
        <Icon name="x" size={15} color={C.sub} stroke={2.4} />
      </Pressable>
    </Glass>
  );
}

// The live banner inside the iOS 26 tab bar accessory (the glass strip above the tabs,
// like a music mini player). The system draws the glass; this only draws the content.
// When the tab bar shrinks on scroll, it sits inline next to it and shows the title only.
export function LiveAccessory({ alert }: { alert: Alert }) {
  const { dismissAlert, openTarget } = useStore();
  const inline = NativeTabs.BottomAccessory.usePlacement() === 'inline';
  return (
    <View style={st.acc}>
      <Pressable style={st.alertMain} onPress={() => openTarget(alert.target)} accessibilityRole="button" accessibilityLabel={`${alert.title}. ${alert.text}`}>
        <View style={st.liveDot} />
        <View style={{ flex: 1 }}>
          <Text style={st.accTitle} numberOfLines={1}>{alert.title}</Text>
          {!inline && alert.text ? <Text style={st.accText} numberOfLines={1}>{alert.text}</Text> : null}
        </View>
      </Pressable>
      {!inline ? (
        <Pressable onPress={dismissAlert} hitSlop={10} style={st.alertClose} accessibilityRole="button" accessibilityLabel="Dismiss banner">
          <Icon name="x" size={15} color={C.sub} stroke={2.4} />
        </Pressable>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  col: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20 },
  top: { position: 'absolute', left: 0, right: 0, top: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 26, paddingLeft: 10, paddingRight: 16, height: 52, overflow: 'hidden' },
  hGroup: { flexDirection: 'row', alignItems: 'center', gap: 2, borderRadius: 26, paddingHorizontal: 6, height: 52, overflow: 'hidden' },
  ring: { position: 'absolute', width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5B81F' },
  tip: { position: 'absolute', top: 60, right: 0, backgroundColor: C.ink, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, minWidth: 140 },
  tipArrow: { position: 'absolute', top: -5, right: 58, width: 12, height: 12, backgroundColor: C.ink, transform: [{ rotate: '45deg' }] },
  tipText: { color: C.white, fontSize: 13, fontWeight: '800' },
  hDot: { position: 'absolute', top: 7, right: 7, width: 9, height: 9, borderRadius: 5, backgroundColor: '#E0445C', borderWidth: 1.5, borderColor: C.white },
  footer: { marginTop: 48, alignItems: 'center' },
  footRule: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 22 },
  footRow: { flexDirection: 'row', justifyContent: 'center', gap: 22, marginBottom: 20 },
  footLink: { alignItems: 'center', gap: 6, minWidth: 56 },
  footIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line },
  footLabel: { fontSize: 12, fontWeight: '700', color: C.sub },
  footName: { fontSize: 13, fontWeight: '800', color: C.sub },
  footSmall: { fontSize: 12, color: C.faint, marginTop: 2 },
  logo: { width: 19, height: 33 },
  topEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, color: C.sub },
  topName: { fontSize: 16, fontWeight: '900', color: C.ink, letterSpacing: -0.2 },
  alert: { marginTop: 8, flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingLeft: 14, paddingRight: 6, paddingVertical: 10, overflow: 'hidden' },
  alertMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#E0445C' },
  alertTitle: { fontSize: 14, lineHeight: 18, fontWeight: '800', color: C.ink },
  alertText: { fontSize: 13, lineHeight: 17, color: C.sub, marginTop: 1 },
  alertClose: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  hBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  hCount: { position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: C.white },
  hCountText: { color: C.white, fontSize: 10, fontWeight: '900' },
  hAvatar: { width: 36, height: 36, borderRadius: 18, marginLeft: 2, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  hAvatarText: { color: C.white, fontSize: 16, fontWeight: '900' },
  acc: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 4 },
  accTitle: { fontSize: 14, fontWeight: '800', color: C.ink },
  accText: { fontSize: 12, color: C.sub },
});
