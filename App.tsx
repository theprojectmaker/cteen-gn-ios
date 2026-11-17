import React, { useEffect, useRef, useState } from 'react';
import { AppState, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Updates from 'expo-updates';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from './src/theme';
import { Icon } from './src/icons';
import { Glass } from './src/glass';
import { CHAPTER, StoreProvider, useStore, type Tab } from './src/store';
import { Chapter, EventSheet, Events, Feed, Home } from './src/screens';
import { ChallengeSheet } from './src/rewards';
import { AdminPanel } from './src/admin';

const TABS: { key: Tab; icon: string }[] = [
  { key: 'Home', icon: 'home' },
  { key: 'Events', icon: 'compass' },
  { key: 'Feed', icon: 'chat' },
  { key: 'Chapter', icon: 'users' },
];

// Over-the-air updates: every push to main publishes one. The app checks when it opens or comes
// back to the front, downloads quietly, and switches to it the next time it is opened.
function useOtaUpdates() {
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

function Shell() {
  useOtaUpdates();
  const insets = useSafeAreaInsets();
  const { tab, go, refresh, liveAlert, dismissAlert, openTarget } = useStore();
  const scroll = useRef<ScrollView>(null);
  const [topH, setTopH] = useState(insets.top + 70);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
    refresh();
  }, [tab]);
  return (
    <View style={st.root}>
      <StatusBar style="dark" />
      {/* Content scrolls underneath the floating glass header and tab bar. */}
      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ paddingTop: topH + 14, paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        <View style={st.col}>
          {tab === 'Home' ? <Home /> : tab === 'Events' ? <Events /> : tab === 'Feed' ? <Feed /> : <Chapter />}
        </View>
      </ScrollView>

      <View style={[st.top, { paddingTop: insets.top + 8 }]} onLayout={(e) => setTopH(e.nativeEvent.layout.height)} pointerEvents="box-none">
        <View style={st.col} pointerEvents="box-none">
          <Glass style={st.header}>
            <Image source={require('./assets/logo.png')} style={st.logo} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <Text style={st.topEyebrow}>YOUR CHAPTER</Text>
              <Text style={st.topName}>{CHAPTER.name}, NY</Text>
            </View>
          </Glass>
          {liveAlert ? (
            <Glass style={st.alert}>
              <Pressable style={st.alertMain} onPress={() => openTarget(liveAlert.target)} disabled={!liveAlert.target} accessibilityRole={liveAlert.target ? 'button' : 'text'} accessibilityLabel={`${liveAlert.title}. ${liveAlert.text}`}>
                <View style={st.liveDot} />
                <View style={{ flex: 1 }}>
                  <Text style={st.alertTitle} numberOfLines={2}>{liveAlert.title}</Text>
                  {liveAlert.text ? <Text style={st.alertText} numberOfLines={2}>{liveAlert.text}</Text> : null}
                </View>
                {liveAlert.target ? <Icon name="right" size={16} color={C.ink} stroke={2.4} /> : null}
              </Pressable>
              <Pressable onPress={dismissAlert} hitSlop={10} style={st.alertClose} accessibilityRole="button" accessibilityLabel="Dismiss banner">
                <Icon name="x" size={15} color={C.sub} stroke={2.4} />
              </Pressable>
            </Glass>
          ) : null}
        </View>
      </View>

      <View style={[st.barWrap, { bottom: Math.max(insets.bottom, 14) }]} pointerEvents="box-none">
        <Glass style={st.bar} interactive>
          {TABS.map((t) => {
            const on = t.key === tab;
            return (
              <Pressable key={t.key} onPress={() => go(t.key)} style={[st.tab, on && st.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t.key}>
                <Icon name={t.icon} size={22} color={on ? C.blue : C.ink} stroke={on ? 2.3 : 1.8} />
                <Text style={[st.tabText, on && { color: C.blue }]}>{t.key}</Text>
              </Pressable>
            );
          })}
        </Glass>
      </View>

      <EventSheet />
      <ChallengeSheet />
      <AdminPanel />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </SafeAreaProvider>
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
  barWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 20 },
  bar: { flexDirection: 'row', borderRadius: 34, padding: 6, width: '100%', maxWidth: 420, overflow: 'hidden' },
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 8, borderRadius: 28 },
  tabOn: { backgroundColor: 'rgba(21,159,220,0.12)' },
  tabText: { fontSize: 11, fontWeight: '700', color: C.ink },
});
