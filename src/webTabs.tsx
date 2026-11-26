import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { Tabs } from 'expo-router/js-tabs';
import { C, R, SH } from './theme';
import { Glass } from './glass';
import { useStore } from './store';

// Browser preview only. Phones use Apple's own tab bar, which has the real Liquid Glass
// animation. This imitates it in the Flyer look: a dark glass capsule, a soft lens behind the
// selected tab that stretches while it slides and can be dragged with a finger, and a fade to the
// page color behind the bar so content dims before it reaches it.
const ITEMS: Record<string, { label: string; icon: React.ReactNode }> = {
  index: { label: 'Home', icon: <Path d="M3.5 10.6 12 3.5l8.5 7.1V19.5a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z" /> },
  events: { label: 'Events', icon: <><Path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.2a1.8 1.8 0 0 0 0 3.6V16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2.2a1.8 1.8 0 0 0 0-3.6z" /><Path d="M14.5 6.5v11" strokeDasharray="2 2.4" /></> },
  calendar: { label: 'Calendar', icon: <><Rect x="3.5" y="5.5" width="17" height="15" rx="2.5" /><Path d="M3.5 10.2h17M8 3.5v4M16 3.5v4" /></> },
  feed: { label: 'Feed', icon: <Path d="M20.5 11.8a8.3 8.3 0 0 1-12.2 7.3L3.5 20.5l1.5-4.5a8.3 8.3 0 1 1 15.5-4.2z" /> },
  chapter: { label: 'Chapter', icon: <><Circle cx="9.5" cy="8" r="3.3" /><Path d="M3 19.5v-1a4.5 4.5 0 0 1 4.5-4.5h4a4.5 4.5 0 0 1 4.5 4.5v1M16 4.9a3.3 3.3 0 0 1 0 6.2M21 19.5v-1a4.5 4.5 0 0 0-3-4.2" /></> },
};

type BarProps = { state: { index: number; routes: { key: string; name: string }[] }; navigation: { navigate: (name: string) => void } };
const NATIVE = Platform.OS !== 'web';
const TAB_H = 52;

function TabIcon({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </Svg>
  );
}

function GlassBar({ state, navigation }: BarProps) {
  const { unreadFeed, newEvents } = useStore();
  const fadeId = 'tb' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const routes = state.routes.filter((r) => ITEMS[r.name]);
  const [rowW, setRowW] = useState(0);
  const slot = rowW ? rowW / routes.length : 0;
  const x = useRef(new Animated.Value(0)).current;      // lens position (left edge)
  const stretch = useRef(new Animated.Value(0)).current; // 0 resting, 1 moving
  const first = useRef(true);
  const dragging = useRef(false);

  const settle = (to: number) => {
    Animated.parallel([
      Animated.spring(x, { toValue: to, useNativeDriver: NATIVE, damping: 16, stiffness: 190, mass: 0.9 }),
      Animated.sequence([
        Animated.timing(stretch, { toValue: 1, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
        Animated.spring(stretch, { toValue: 0, useNativeDriver: NATIVE, damping: 9, stiffness: 180 }),
      ]),
    ]).start();
  };

  useEffect(() => {
    if (!slot || dragging.current) return;
    const to = state.index * slot;
    if (first.current) { x.setValue(to); first.current = false; return; }
    settle(to);
  }, [state.index, slot]);

  // Drag the lens across the bar; let go to pick the tab under it.
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderGrant: () => {
      dragging.current = true;
      Animated.spring(stretch, { toValue: 1, useNativeDriver: NATIVE, damping: 14, stiffness: 220 }).start();
    },
    onPanResponderMove: (_, g) => {
      if (!slot) return;
      x.setValue(Math.max(0, Math.min(rowW - slot, state.index * slot + g.dx)));
    },
    onPanResponderRelease: (_, g) => {
      dragging.current = false;
      if (!slot) return;
      const pos = Math.max(0, Math.min(rowW - slot, state.index * slot + g.dx));
      const i = Math.round(pos / slot);
      settle(i * slot);
      if (i !== state.index) navigation.navigate(routes[i].name);
    },
    onPanResponderTerminate: () => { dragging.current = false; settle(state.index * slot); },
  }), [slot, rowW, state.index, routes]);

  const lensScaleX = stretch.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const lensScaleY = stretch.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });

  return (
    <View style={st.wrap} pointerEvents="box-none">
      {/* content dims into the page color before it reaches the bar */}
      <View style={st.scrim} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id={fadeId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={C.bg} stopOpacity={0} />
              <Stop offset="0.22" stopColor={C.bg} stopOpacity={1} />
              <Stop offset="1" stopColor={C.bg} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${fadeId})`} />
        </Svg>
      </View>
      <Glass tone="bar" style={st.bar}>
        <View style={st.row} onLayout={(e) => setRowW(e.nativeEvent.layout.width)} {...pan.panHandlers}>
          {slot ? <Animated.View pointerEvents="none" style={[st.lens, { width: slot, transform: [{ translateX: x }, { scaleX: lensScaleX }, { scaleY: lensScaleY }] }]} /> : null}
          {routes.map((r, i) => {
            const item = ITEMS[r.name];
            const on = state.index === i;
            const badge = r.name === 'feed' ? unreadFeed : r.name === 'events' ? newEvents : 0;
            // Icons swell a little while the lens is moving over them, like looking through a drop
            // of water; at rest every icon is the same size.
            const near = slot ? x.interpolate({ inputRange: [(i - 1) * slot, i * slot, (i + 1) * slot], outputRange: [0, 0.2, 0], extrapolate: 'clamp' }) : 0;
            const mag = slot ? Animated.add(1, Animated.multiply(near as Animated.AnimatedInterpolation<number>, stretch)) : 1;
            const tint = on ? C.blue : C.tabIcon;
            return (
              <Pressable key={r.key} onPress={() => navigation.navigate(r.name)} style={st.tab} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={badge ? `${item.label}, ${badge} new` : item.label}>
                <Animated.View style={{ alignItems: 'center', gap: 4, transform: [{ scale: mag as any }] }}>
                  <View>
                    <TabIcon color={tint}>{item.icon}</TabIcon>
                    {badge ? <View style={st.badge}><Text style={st.badgeText}>{badge > 9 ? '9+' : badge}</Text></View> : null}
                  </View>
                  <Text style={[st.text, { color: tint }]}>{item.label}</Text>
                </Animated.View>
              </Pressable>
            );
          })}
        </View>
      </Glass>
    </View>
  );
}

export function WebTabs() {
  return (
    <Tabs screenOptions={{ headerShown: false, animation: 'fade', sceneStyle: { backgroundColor: C.bg } }} tabBar={(p) => <GlassBar {...(p as unknown as BarProps)} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="events" />
      <Tabs.Screen name="calendar" />
      <Tabs.Screen name="feed" />
      <Tabs.Screen name="chapter" />
    </Tabs>
  );
}

// Sizes from the mockup: 18 from the sides, 26 from the bottom, 64 tall, radius 32, 6 of padding;
// each tab 52 tall with a 22 icon, a 4 gap and a 10 pt label; the fade behind it is 112 tall.
const st = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 112, alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 18, paddingBottom: 26 },
  scrim: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  bar: { height: 64, borderRadius: R.tabBar, paddingHorizontal: 6, width: '100%', maxWidth: 420, justifyContent: 'center', ...SH.bar },
  row: { flexDirection: 'row', height: TAB_H },
  lens: { position: 'absolute', left: 0, top: 0, height: TAB_H, borderRadius: TAB_H / 2, backgroundColor: C.lens },
  tab: { flex: 1, height: TAB_H, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 10, lineHeight: 10, fontWeight: '600' },
  badge: { position: 'absolute', top: -6, right: -11, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: C.card },
  badgeText: { color: C.onOrange, fontSize: 10, lineHeight: 12, fontWeight: '800' },
});
