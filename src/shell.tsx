import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, Image, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import * as Updates from 'expo-updates';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { C, F, PREFS, R, SP, T, numeral } from './theme';
import { Icon, challengeIcon } from './icons';
import { wrapWindow } from './zmanim';
import { WrapBanner, useWrapStatus } from './wrap';
import { Glass } from './glass';
import { Avatar, Backdrop, Band, Hairline, Label, LiveDot, Print, Stat, eventPicture } from './look';
import { CHAPTER, challengeFits, doneThisPeriod, open, streak, useShabbat, useStore, type Alert } from './store';

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

// The frame, measured from the mockup: the bar starts 4 pt under the status bar, is 54 tall,
// 16 pt from the screen edges, and the page starts 16 pt under it with an 18 pt gutter.
const BAR_TOP = 4;
const BAR_H = 54;

// One tab's page: the Flyer backdrop (it does not scroll), the page itself, and the glass header
// bar pinned on top. Pull down to refresh. The first time a tab opens, the page eases in.
// `scoreboard`: this page shows the challenge scoreboard (Home). That band already carries the
// last hour (the live "left to wrap" clock and SNAP for a teen in the challenge, "MIN LEFT TODAY"
// beside JOIN for one who is not), so the solid orange last-hour banner is not drawn a second
// time above it. Every other tab still gets it.
export function Screen({ children, scoreboard }: { children: React.ReactNode; scoreboard?: boolean }) {
  const insets = useSafeAreaInsets();
  const { refresh, liveAlert } = useStore();
  const wrap = useWrapStatus();
  const wrapBanner = !!wrap?.lastHour && !scoreboard;
  const [refreshing, setRefreshing] = useState(false);
  const enter = useRef(new Animated.Value(PREFS.reduceMotion ? 1 : 0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
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
  const barBottom = insets.top + BAR_TOP + BAR_H;
  return (
    <View style={st.root}>
      <Backdrop />
      <Animated.ScrollView automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive"
        style={st.fill}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingTop: barBottom + 16, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 122 : 32) }}
        scrollIndicatorInsets={{ top: barBottom }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: NATIVE_DRIVER })}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue} colors={[C.blue]} progressViewOffset={barBottom + 8} />}>
        <View style={st.col}>
          {/* at most one banner at a time, the most urgent one */}
          {wrapBanner ? <WrapBanner /> : liveAlert ? <TopAlert alert={liveAlert} /> : <ShabbatBanner />}
          <Animated.View style={{ opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
            {children}
          </Animated.View>
        </View>
      </Animated.ScrollView>
      {/* pinned: once the page has scrolled, a soft fade to the page color under the status bar
          (at rest it is clear, so the glow of the backdrop shows whole), then the glass bar */}
      <TopFade height={insets.top + 30} scrollY={scrollY} />
      <View style={[st.pinned, { paddingTop: insets.top + BAR_TOP }]} pointerEvents="box-none">
        <View style={st.barCol} pointerEvents="box-none">
          <Header />
        </View>
      </View>
    </View>
  );
}

function TopFade({ height, scrollY }: { height: number; scrollY: Animated.Value }) {
  const id = 'tf' + React.useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <Animated.View pointerEvents="none" style={[st.topFade, { height, opacity: scrollY.interpolate({ inputRange: [0, 28], outputRange: [0, 1], extrapolate: 'clamp' }) }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.bg} stopOpacity={1} />
            <Stop offset="0.62" stopColor={C.bg} stopOpacity={0.9} />
            <Stop offset="1" stopColor={C.bg} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

// One continuous glass bar: the mark, the chapter's name, the streak chip and your profile.
function Header() {
  return (
    <Glass style={st.header}>
      <Image source={require('../assets/mark.png')} style={st.logo} resizeMode="contain" />
      <Text style={st.topName} numberOfLines={1}>{CHAPTER.name}</Text>
      <HeaderButtons />
    </Glass>
  );
}

// The streak chip (opens the main challenge, with a one-time tip) and the profile circle (settings).
function HeaderButtons() {
  const { content, name, checks, joined, tipSeen, hideTip, gender } = useStore();
  const live = content.challenges.filter((c) => c.active && challengeFits(c, gender));
  const main = live.find((c) => c.id === 'tefillin') ?? live[0];
  const mine = !!main && joined.includes(main.id);
  // pulses only while you can actually do it (tefillin: sunrise to sunset, not Shabbat)
  const due = !!main && (!mine || !doneThisPeriod(main, checks)) && (main.id !== 'tefillin' || wrapWindow().state === 'open');
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
  return (
    <View style={st.hBtns}>
      {main ? (
        <Pressable onPress={openIt} style={({ pressed }) => pressed && { opacity: 0.6 }} hitSlop={{ top: 8, bottom: 8, left: 6, right: 4 }} accessibilityRole="button" accessibilityLabel={main.title}>
          {due && !PREFS.reduceMotion ? (
            <Animated.View pointerEvents="none" style={[st.ring, {
              opacity: pulse.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.75, 0] }),
              transform: [{ scaleX: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] }) }, { scaleY: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }],
            }]} />
          ) : null}
          <View style={st.chip}>
            <Icon name={challengeIcon(main)} size={17} color={C.orangeText} stroke={2.1} />
            <Text style={st.chipText}>{mine ? streak(main, checks) : 'Join'}</Text>
          </View>
        </Pressable>
      ) : null}
      <Pressable onPress={() => router.push('/settings')} style={({ pressed }) => pressed && { opacity: 0.6 }} hitSlop={{ top: 6, bottom: 6, left: 4, right: 6 }} accessibilityRole="button" accessibilityLabel="Profile and settings">
        <Avatar name={name} size={34} ring={2} />
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
    <View style={st.banner} accessibilityLiveRegion={counting ? 'polite' : 'none'}>
      <Band>
        {counting ? (
          <>
            <Label tone="orange">Shabbat starts in</Label>
            <View style={st.shabRow}>
              <Text style={numeral(46, C.orangeText)}>{pad(mm)}:{pad(ss)}</Text>
              <Text style={[T.small, st.shabSide]}>Candle lighting at {sh.candles}</Text>
            </View>
          </>
        ) : during ? (
          <>
            <Label tone="orange">Shabbat in Great Neck{sh.parsha ? ` · ${sh.parsha}` : ''}</Label>
            <Text style={[T.h1, st.shabTitle]}>Shabbat Shalom</Text>
            <Text style={[T.small, { marginTop: 4 }]}>Shabbat ends at {sh.havdalah}</Text>
          </>
        ) : (
          <>
            <Label tone="orange">Shabbat in Great Neck{sh.parsha ? ` · ${sh.parsha}` : ''}</Label>
            <Stat value={sh.candles ?? ''} label="Candle lighting tonight" size={40} style={{ marginTop: 6 }} />
          </>
        )}
      </Band>
    </View>
  );
}

// The rabbi's live banner: a band at the top of every page. A red dot and LIVE, the message, a
// link, and the event's poster as a small print when it points to an event. Tap to open, x to dismiss.
function TopAlert({ alert }: { alert: Alert }) {
  const { dismissAlert, openTarget, content } = useStore();
  const ev = alert.target?.type === 'event' ? content.events.find((e) => e.id === alert.target!.id) : undefined;
  const picture = ev ? eventPicture(ev) : null;
  return (
    <View style={st.banner}>
      <Band>
        <Pressable style={st.liveMain} onPress={() => openTarget(alert.target)} disabled={!alert.target} accessibilityRole={alert.target ? 'button' : 'text'} accessibilityLabel={`Live: ${alert.title}. ${alert.text}`}>
          <View style={st.liveText}>
            <View style={st.liveTag}>
              <LiveDot />
              <Label tone="red">Live</Label>
            </View>
            <Text style={[T.h3, { marginTop: 7 }]} numberOfLines={2}>{alert.title}</Text>
            {alert.text ? <Text style={[T.small, { marginTop: 3 }]} numberOfLines={2}>{alert.text}</Text> : null}
            {alert.target ? <Label tone="blue" style={{ marginTop: 9 }}>{ev ? 'See the event' : 'Open'}</Label> : null}
          </View>
          {picture ? <Print source={picture.source} width={54} /> : null}
        </Pressable>
        <Pressable onPress={dismissAlert} hitSlop={12} style={st.liveClose} accessibilityRole="button" accessibilityLabel="Dismiss banner">
          <Icon name="x" size={14} color={C.sub} stroke={2.6} />
        </Pressable>
      </Band>
    </View>
  );
}

// The live banner inside the iOS 26 tab bar accessory (the glass strip above the tabs).
export function LiveAccessory({ alert }: { alert: Alert }) {
  const { dismissAlert, openTarget } = useStore();
  const inline = NativeTabs.BottomAccessory.usePlacement() === 'inline';
  return (
    <View style={st.acc}>
      <Pressable style={st.accMain} onPress={() => openTarget(alert.target)} accessibilityRole="button" accessibilityLabel={`${alert.title}. ${alert.text}`}>
        <View style={st.accDot} />
        <View style={{ flex: 1 }}>
          <Text style={st.accTitle} numberOfLines={1}>{alert.title}</Text>
          {!inline && alert.text ? <Text style={st.accText} numberOfLines={1}>{alert.text}</Text> : null}
        </View>
      </Pressable>
      {!inline ? (
        <Pressable onPress={dismissAlert} hitSlop={10} style={st.accClose} accessibilityRole="button" accessibilityLabel="Dismiss banner">
          <Icon name="x" size={15} color={C.sub} stroke={2.4} />
        </Pressable>
      ) : null}
    </View>
  );
}

// For the bottom of a page that wants it: the shortcuts as plain cyan labels, then the chapter's
// name and address. No circles, no icons.
export function Footer() {
  const { go } = useStore();
  const links = [
    { label: 'Events', onPress: () => go('Events') },
    { label: 'Feed', onPress: () => go('Feed') },
    { label: 'Instagram', onPress: () => open(CHAPTER.instagram) },
    { label: 'Hours', onPress: () => open('https://myportal.cteen.com/service') },
  ];
  return (
    <View style={st.footer}>
      <Hairline />
      <View style={st.footRow}>
        {links.map((l) => <Label key={l.label} tone="blue" onPress={l.onPress} accessibilityLabel={l.label}>{l.label}</Label>)}
      </View>
      <Label>{CHAPTER.name}</Label>
      <Text style={st.footSmall}>{CHAPTER.org} · 400 East Shore Road</Text>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  fill: { flex: 1 },
  col: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: SP.gutter },
  pinned: { position: 'absolute', left: 0, right: 0, top: 0, zIndex: 20 },
  topFade: { position: 'absolute', left: 0, right: 0, top: 0, zIndex: 19 },
  barCol: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 16 },
  // the header bar
  // No shadow under it: on the mockup the glow of the page carries on, undimmed, right below the bar.
  header: { height: BAR_H, borderRadius: R.header, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 13, paddingRight: 8, zIndex: 5 },
  logo: { width: 28, height: 36 },
  topName: { flex: 1, fontFamily: F.display, fontSize: 20, lineHeight: 22, letterSpacing: 0.7, color: C.ink, textTransform: 'uppercase', paddingRight: 3 },
  hBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: { height: 32, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 3, paddingLeft: 8, paddingRight: 9, backgroundColor: C.orangePale },
  chipText: { fontFamily: F.display, fontSize: 19, lineHeight: 21, color: C.orangeText, textTransform: 'uppercase', paddingRight: 2 },
  ring: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 16, borderWidth: 1.5, borderColor: C.orangeText },
  tip: { position: 'absolute', top: 47, right: 0, backgroundColor: C.paper, borderRadius: R.chip, paddingHorizontal: 12, paddingVertical: 8, minWidth: 150, zIndex: 10 },
  tipArrow: { position: 'absolute', top: -5, right: 66, width: 12, height: 12, backgroundColor: C.paper, transform: [{ rotate: '45deg' }] },
  tipText: { fontFamily: F.bold, fontSize: 15, lineHeight: 17, letterSpacing: 0.5, color: C.night, textTransform: 'uppercase' },
  // banners
  banner: { marginBottom: 18 },
  shabRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 14, marginTop: 4 },
  shabSide: { flex: 1, paddingBottom: 6 },
  shabTitle: { marginTop: 6 },
  liveMain: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingRight: 30 },
  liveText: { flex: 1, minWidth: 0 },
  liveTag: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveClose: { position: 'absolute', top: 6, right: SP.gutter - 8, width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  // the tab bar accessory on iOS 26
  acc: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 4 },
  accMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  accDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.red },
  accTitle: { fontSize: 14, fontWeight: '700', color: C.ink },
  accText: { fontSize: 12, color: C.sub },
  accClose: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  // footer
  footer: { marginTop: 48, alignItems: 'center' },
  footRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 24, marginTop: 22, marginBottom: 20 },
  footSmall: { fontSize: 12, color: C.faint, marginTop: 4 },
});
