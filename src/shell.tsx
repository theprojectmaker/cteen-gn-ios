import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, Image, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import * as Updates from 'expo-updates';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { C, HUES, IS_DARK as IS_DARK_UI, PREFS, R, F } from './theme';
import { Icon, challengeIcon } from './icons';
import { wrapWindow } from './zmanim';
import { WrapBanner, useWrapStatus } from './wrap';
import { Glass, LIQUID } from './glass';
import { Cover } from './ui';
import { CHAPTER, challengeFits, doneThisPeriod, open, useShabbat, useStore, type Alert } from './store';

const NATIVE_DRIVER = Platform.OS !== 'web';

// Over-the-air updates: every push to main publishes one. The app checks when it opens or comes
// back to the front, downloads quietly, and switches to it the next time it is opened.
export function useOtaUpdates() {
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    let ready = false;
    let busy = false;
    const openedAt = Date.now();
    const check = async () => {
      if (ready) { Updates.reloadAsync().catch(() => {}); return; }
      if (busy) return;
      busy = true;
      try {
        const r = await Updates.checkForUpdateAsync();
        if (r.isAvailable) ready = (await Updates.fetchUpdateAsync()).isNew;
        // Fresh install or long gap: if the newer code arrives in the first few seconds (while the
        // opening animation plays), switch to it right away instead of waiting for the next open.
        // Otherwise a newly installed TestFlight build shows its older built-in code first.
        if (ready && Date.now() - openedAt < 8000) { Updates.reloadAsync().catch(() => {}); return; }
      } catch { /* offline: try again next time */ }
      busy = false;
    };
    check();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') check(); });
    return () => sub.remove();
  }, []);
}

export function greetingNow(d = new Date()) {
  const h = d.getHours();
  return h >= 5 && h < 12 ? 'Good morning' : h >= 12 && h < 17 ? 'Good afternoon' : 'Good evening';
}

// One tab's page. The glass header is part of the page and scrolls away with it.
// Pull down to refresh. Each time the tab opens, the page eases in.
export function Screen({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { refresh, liveAlert } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const enter = useRef(new Animated.Value(PREFS.reduceMotion ? 1 : 0)).current;
  // Ease in once when the page first opens; coming back to a tab is instant (no flicker).
  useEffect(() => {
    if (PREFS.reduceMotion) return;
    Animated.timing(enter, { toValue: 1, duration: 300, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: NATIVE_DRIVER }).start();
  }, []);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  const onRefresh = async () => {
    setRefreshing(true);
    await refresh(true);
    setRefreshing(false);
  };
  return (
    <View style={st.root}>
      <ScrollView automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive"
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 110 : 32) }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue} colors={[C.blue]} progressViewOffset={insets.top} />}>
        <View style={st.col}>
          <Header />
          {liveAlert ? <TopAlert alert={liveAlert} /> : null}
          <WrapBanner />
          <ShabbatBanner />
          <Animated.View style={{ opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
            {children}
            <Footer />
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}

// One continuous glass bar (the build 4 look): logo, chapter name, the tefillin button and your profile.
function Header() {
  return (
    <Glass style={st.header}>
      <Image source={require('../assets/logo.png')} style={st.logo} resizeMode="contain" />
      <View style={{ flex: 1 }}>
        <Text style={st.topEyebrow}>YOUR CHAPTER</Text>
        <Text style={st.topName} numberOfLines={1}>{CHAPTER.name}, NY</Text>
      </View>
      <HeaderButtons />
    </Glass>
  );
}

// Pulsing trophy (opens the Tefillin Challenge, with a one-time tip) and the profile picture (settings).
function HeaderButtons() {
  const { content, name, checks, joined, tipSeen, hideTip, gender, leader, setComposerOpen } = useStore();
  const live = content.challenges.filter((c) => c.active && challengeFits(c, gender));
  const main = live.find((c) => c.id === 'tefillin') ?? live[0];
  // pulses only while you can actually do it (tefillin: sunrise to sunset, not Shabbat)
  const due = !!main && (!joined.includes(main.id) || !doneThisPeriod(main, checks)) && (main.id !== 'tefillin' || wrapWindow().state === 'open');
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!due || PREFS.reduceMotion) { pulse.stopAnimation(); pulse.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE_DRIVER }),
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
    <View style={st.hBtns}>
      {main ? (
        <Pressable onPress={openIt} style={({ pressed }) => [st.hBtn, pressed && { opacity: 0.55 }]} hitSlop={4} accessibilityRole="button" accessibilityLabel={main.title}>
          {due ? <Animated.View pointerEvents="none" style={[st.ring, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]} /> : null}
          <Animated.View style={{ transform: [{ scale: iconScale }] }}>
            <Icon name={challengeIcon(main)} size={21} color={due ? '#C27A12' : C.ink} stroke={2} />
          </Animated.View>
          {due ? <View style={st.hDot} /> : null}
        </Pressable>
      ) : null}
      {leader ? (
        <Pressable onPress={() => setComposerOpen(true)} style={({ pressed }) => [st.hBtn, pressed && { opacity: 0.55 }]} hitSlop={4} accessibilityRole="button" accessibilityLabel="New post">
          <Icon name="plus" size={21} color={C.ink} stroke={2.4} />
        </Pressable>
      ) : null}
      <Pressable onPress={() => router.push('/settings')} style={({ pressed }) => [st.hAvatar, pressed && { opacity: 0.6 }]} hitSlop={4} accessibilityRole="button" accessibilityLabel="Profile and settings">
        {name ? <Text style={st.hAvatarText}>{name[0].toUpperCase()}</Text> : <Icon name="user" size={17} color={C.white} stroke={2.2} />}
      </Pressable>
      {main && !tipSeen ? (
        <Pressable onPress={openIt} style={st.tip} accessibilityRole="button" accessibilityLabel={`New: ${main.title}`}>
          <View style={st.tipArrow} />
          <Text style={st.tipText}>{main.title}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// Fridays: candle-lighting time. In the last hour: a live countdown. During Shabbat: Shabbat Shalom.
function ShabbatBanner() {
  const sh = useShabbat();
  const wrap = useWrapStatus();
  const [now, setNow] = useState(Date.now());
  const candles = sh && sh !== 'error' ? sh.candlesAt : undefined;
  const ends = sh && sh !== 'error' ? sh.havdalahAt : undefined;
  const sameDay = !!candles && new Date(candles).toDateString() === new Date(now).toDateString();
  const left = candles ? candles - now : 0;
  const counting = !!candles && left > 0 && left <= 3600 * 1000;
  const during = !!candles && !!ends && now >= candles && now < ends;
  useEffect(() => {
    if (!candles) return;
    const tick = setInterval(() => setNow(Date.now()), counting ? 1000 : 30000);
    return () => clearInterval(tick);
  }, [candles, counting]);
  if (!sh || sh === 'error' || !candles) return null;
  if (wrap?.lastHour && wrap.win.friday) return null; // the wrap-before-Shabbat banner comes first
  if (!(sameDay && left > 0) && !during) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000);
  return (
    <View style={[st.shabbat, counting ? { backgroundColor: HUES.orange.solid } : during ? { backgroundColor: '#3B2A6B' } : { backgroundColor: C.tanPale, borderWidth: 1, borderColor: C.tan }]} accessibilityLiveRegion={counting ? 'polite' : 'none'}>
      <View style={[st.shabbatIcon, (counting || during) && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
        <Icon name="flame" size={22} color={counting || during ? C.white : '#B5772A'} stroke={2} />
      </View>
      <View style={{ flex: 1 }}>
        {counting ? (
          <>
            <Text style={st.shabbatKicker}>SHABBAT STARTS IN</Text>
            <Text style={st.countdown}>{pad(mm)}:{pad(ss)}</Text>
            <Text style={st.shabbatSubLight}>Candle lighting at {sh.candles}</Text>
          </>
        ) : during ? (
          <>
            <Text style={st.shabbatTitleLight}>Shabbat Shalom</Text>
            <Text style={st.shabbatSubLight}>Shabbat ends at {sh.havdalah}</Text>
          </>
        ) : (
          <>
            <Text style={st.shabbatTitle}>Candle lighting tonight at {sh.candles}</Text>
            <Text style={st.shabbatSub}>Shabbat in Great Neck{sh.parsha ? ` · ${sh.parsha}` : ''}</Text>
          </>
        )}
      </View>
    </View>
  );
}

// The rabbi's live banner: a card at the top of every page. LIVE tag with a breathing dot, the message,
// the event's photo when it points to an event. Tap to open, x to dismiss.
function TopAlert({ alert }: { alert: Alert }) {
  const { dismissAlert, openTarget, content } = useStore();
  const ev = alert.target?.type === 'event' ? content.events.find((e) => e.id === alert.target!.id) : undefined;
  const dot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (PREFS.reduceMotion) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(dot, { toValue: 1, duration: 900, useNativeDriver: NATIVE_DRIVER }),
      Animated.timing(dot, { toValue: 0, duration: 900, useNativeDriver: NATIVE_DRIVER }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <View style={st.live}>
      <Pressable style={st.liveMain} onPress={() => openTarget(alert.target)} disabled={!alert.target} accessibilityRole={alert.target ? 'button' : 'text'} accessibilityLabel={`Live: ${alert.title}. ${alert.text}`}>
        <View style={{ flex: 1 }}>
          <View style={st.liveTag}>
            <Animated.View style={[st.liveTagDot, { opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }) }]} />
            <Text style={st.liveTagText}>Live</Text>
          </View>
          <Text style={st.liveTitle} numberOfLines={2}>{alert.title}</Text>
          {alert.text ? <Text style={st.liveText} numberOfLines={2}>{alert.text}</Text> : null}
          {alert.target ? <Text style={st.liveCta}>{ev ? 'See the event' : 'Open'}</Text> : null}
        </View>
        {ev ? (
          <View style={st.liveThumb}><Cover e={ev} style={StyleSheet.absoluteFill} iconSize={28} /></View>
        ) : null}
      </Pressable>
      <Pressable onPress={dismissAlert} hitSlop={10} style={st.liveClose} accessibilityRole="button" accessibilityLabel="Dismiss banner">
        <Icon name="x" size={13} color={C.sub} stroke={2.6} />
      </Pressable>
    </View>
  );
}

// The live banner inside the iOS 26 tab bar accessory (the glass strip above the tabs).
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
          <Pressable key={l.label} onPress={l.onPress} style={({ pressed }) => [st.footLink, pressed && { opacity: 0.6, transform: [{ scale: 0.96 }] }]} accessibilityRole="button" accessibilityLabel={l.label}>
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

const st = StyleSheet.create({
  live: { marginBottom: 16, borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, overflow: 'hidden', borderLeftWidth: 4, borderLeftColor: '#E8364F' },
  liveMain: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingRight: 40 },
  liveTag: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 8, height: 20, borderRadius: 10, backgroundColor: '#FDE7EA' },
  liveTagDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#E8364F' },
  liveTagText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase', color: '#C21F3A' },
  liveTitle: { fontSize: 16, lineHeight: 21, fontWeight: '800', color: C.ink, marginTop: 6 },
  liveText: { fontSize: 14, lineHeight: 19, color: C.sub, marginTop: 2 },
  liveCta: { fontSize: 13, fontWeight: '800', color: C.blue, marginTop: 6 },
  liveThumb: { width: 64, height: 64, borderRadius: 14, overflow: 'hidden', backgroundColor: C.line },
  liveClose: { position: 'absolute', top: 10, right: 10, width: 26, height: 26, borderRadius: 13, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  root: { flex: 1, backgroundColor: C.bg },
  col: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 18, zIndex: 5 },
  logo: { width: 20, height: 35 },
  topEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, color: C.sub },
  topName: { fontSize: 16, fontWeight: '900', color: C.ink, letterSpacing: -0.2 },
  hBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: IS_DARK_UI ? 'rgba(255,255,255,0.09)' : 'rgba(19,32,44,0.06)', alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 38, height: 38, borderRadius: 19, backgroundColor: '#F5B81F' },
  hDot: { position: 'absolute', top: -1, right: -1, width: 11, height: 11, borderRadius: 6, backgroundColor: '#E0445C', borderWidth: 2, borderColor: C.card },
  hAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  hAvatarText: { color: C.white, fontSize: 16, fontWeight: '900' },
  tip: { position: 'absolute', top: 48, right: 0, backgroundColor: C.inverse, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, minWidth: 140, zIndex: 10 },
  tipArrow: { position: 'absolute', top: -5, right: 59, width: 12, height: 12, backgroundColor: C.inverse, transform: [{ rotate: '45deg' }] },
  tipText: { color: C.onInverse, fontSize: 13, fontWeight: '800' },
  shabbat: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 22, padding: 16, marginBottom: 18 },
  shabbatIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(181,119,42,0.14)', alignItems: 'center', justifyContent: 'center' },
  shabbatKicker: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  countdown: { color: C.white, fontSize: 34, fontFamily: F.display, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  shabbatTitle: { color: C.ink, fontSize: 16, fontWeight: '800' },
  shabbatSub: { color: C.sub, fontSize: 13, marginTop: 2 },
  shabbatTitleLight: { color: C.white, fontSize: 18, fontFamily: F.display },
  shabbatSubLight: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 2, fontWeight: '600' },
  alert: { marginBottom: 16, flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingLeft: 14, paddingRight: 6, paddingVertical: 10, overflow: 'hidden' },
  alertMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#E0445C' },
  alertTitle: { fontSize: 14, lineHeight: 18, fontWeight: '800', color: C.ink },
  alertText: { fontSize: 13, lineHeight: 17, color: C.sub, marginTop: 1 },
  alertClose: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  acc: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 4 },
  accTitle: { fontSize: 14, fontWeight: '800', color: C.ink },
  accText: { fontSize: 12, color: C.sub },
  footer: { marginTop: 48, alignItems: 'center' },
  footRule: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 22 },
  footRow: { flexDirection: 'row', justifyContent: 'center', gap: 22, marginBottom: 20 },
  footLink: { alignItems: 'center', gap: 6, minWidth: 56 },
  footIcon: { width: 48, height: 48, borderRadius: R.pill, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line },
  footLabel: { fontSize: 12, fontWeight: '700', color: C.sub },
  footName: { fontSize: 13, fontWeight: '800', color: C.sub },
  footSmall: { fontSize: 12, color: C.faint, marginTop: 2 },
});
