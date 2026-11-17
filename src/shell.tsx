import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import * as Updates from 'expo-updates';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { C } from './theme';
import { Icon } from './icons';
import { Glass, LIQUID } from './glass';
import { CHAPTER, upcoming, useStore, type Alert } from './store';

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
        <View style={st.col}>{children}</View>
      </ScrollView>
      <View style={[st.top, { paddingTop: insets.top + 8 }]} onLayout={(e) => setTopH(e.nativeEvent.layout.height)} pointerEvents="box-none">
        <View style={st.col} pointerEvents="box-none">
          <Glass style={st.header}>
            <Image source={require('../assets/logo.png')} style={st.logo} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <Text style={st.topEyebrow}>YOUR CHAPTER</Text>
              <Text style={st.topName}>{CHAPTER.name}, NY</Text>
            </View>
            <HeaderButtons />
          </Glass>
          {/* On iOS 26 the live banner lives in the tab bar's accessory instead. */}
          {liveAlert && !LIQUID ? <TopAlert alert={liveAlert} /> : null}
        </View>
      </View>
    </View>
  );
}

// Top-right of the header: Events (with how many are coming up) and your account.
function HeaderButtons() {
  const { content, fits, go, name } = useStore();
  const n = upcoming(content.events).filter(fits).length;
  return (
    <View style={st.hBtns}>
      <Pressable onPress={() => go('Events')} style={({ pressed }) => [st.hBtn, pressed && { opacity: 0.6 }]} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Events, ${n} coming up`}>
        <Icon name="ticket" size={20} color={C.ink} stroke={2} />
        {n > 0 ? <View style={st.hCount}><Text style={st.hCountText}>{n}</Text></View> : null}
      </Pressable>
      <Pressable onPress={() => router.push('/account')} style={({ pressed }) => [st.hAvatar, pressed && { opacity: 0.6 }]} hitSlop={6} accessibilityRole="button" accessibilityLabel="Your account">
        {name ? <Text style={st.hAvatarText}>{name[0].toUpperCase()}</Text> : <Icon name="user" size={18} color={C.white} stroke={2.2} />}
      </Pressable>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 9, overflow: 'hidden' },
  logo: { width: 20, height: 35 },
  topEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, color: C.sub },
  topName: { fontSize: 16, fontWeight: '900', color: C.ink, letterSpacing: -0.2 },
  alert: { marginTop: 8, flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingLeft: 14, paddingRight: 6, paddingVertical: 10, overflow: 'hidden' },
  alertMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#E0445C' },
  alertTitle: { fontSize: 14, lineHeight: 18, fontWeight: '800', color: C.ink },
  alertText: { fontSize: 13, lineHeight: 17, color: C.sub, marginTop: 1 },
  alertClose: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  hBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(19,32,44,0.06)', alignItems: 'center', justifyContent: 'center' },
  hCount: { position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: C.white },
  hCountText: { color: C.white, fontSize: 10, fontWeight: '900' },
  hAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  hAvatarText: { color: C.white, fontSize: 16, fontWeight: '900' },
  acc: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 4 },
  accTitle: { fontSize: 14, fontWeight: '800', color: C.ink },
  accText: { fontSize: 12, color: C.sub },
});
