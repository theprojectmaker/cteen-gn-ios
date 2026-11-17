import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';
import { C } from './theme';
import { Icon } from './icons';
import { Glass } from './glass';
import { useStore } from './store';

// Browser preview only. Phones use Apple's own tab bar, which has the real Liquid Glass
// animation. This imitates it: a clear glass lens that stretches while it slides, magnifies
// the icons it passes over, and can be dragged with a finger.
const ITEMS: Record<string, { label: string; icon: string }> = {
  index: { label: 'Home', icon: 'home' },
  events: { label: 'Events', icon: 'ticket' },
  feed: { label: 'Feed', icon: 'chat' },
  chapter: { label: 'Chapter', icon: 'users' },
};

type BarProps = { state: { index: number; routes: { key: string; name: string }[] }; navigation: { navigate: (name: string) => void } };
const PAD = 6;
const NATIVE = Platform.OS !== 'web';

function GlassBar({ state, navigation }: BarProps) {
  const { unreadFeed } = useStore();
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

  const lensScaleX = stretch.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });
  const lensScaleY = stretch.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  return (
    <View style={st.wrap} pointerEvents="box-none">
      <Glass style={st.bar}>
        <View style={st.row} onLayout={(e) => setRowW(e.nativeEvent.layout.width)} {...pan.panHandlers}>
          {slot ? (
            <Animated.View pointerEvents="none" style={[st.lens, { width: slot, transform: [{ translateX: x }, { scaleX: lensScaleX }, { scaleY: lensScaleY }] }]}>
              <View style={st.lensShine} />
            </Animated.View>
          ) : null}
          {routes.map((r, i) => {
            const item = ITEMS[r.name];
            const on = state.index === i;
            const badge = r.name === 'feed' && unreadFeed > 0 ? unreadFeed : 0;
            // Icons swell as the lens passes over them, like looking through a drop of water.
            const mag = slot
              ? x.interpolate({ inputRange: [(i - 1) * slot, i * slot, (i + 1) * slot], outputRange: [1, 1.22, 1], extrapolate: 'clamp' })
              : 1;
            return (
              <Pressable key={r.key} onPress={() => navigation.navigate(r.name)} style={st.tab} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={badge ? `${item.label}, ${badge} new` : item.label}>
                <Animated.View style={{ alignItems: 'center', gap: 2, transform: [{ scale: mag as any }] }}>
                  <View>
                    <Icon name={item.icon} size={22} color={on ? C.blue : C.ink} stroke={on ? 2.3 : 1.8} />
                    {badge ? <View style={st.badge}><Text style={st.badgeText}>{badge > 9 ? '9+' : badge}</Text></View> : null}
                  </View>
                  <Text style={[st.text, on && { color: C.blue }]}>{item.label}</Text>
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
    <Tabs screenOptions={{ headerShown: false, animation: 'fade' }} tabBar={(p) => <GlassBar {...(p as unknown as BarProps)} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="events" />
      <Tabs.Screen name="feed" />
      <Tabs.Screen name="chapter" />
    </Tabs>
  );
}

const st = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 14, alignItems: 'center', paddingHorizontal: 20 },
  bar: { borderRadius: 36, padding: PAD, width: '100%', maxWidth: 420 },
  row: { flexDirection: 'row' },
  lens: {
    position: 'absolute', left: 0, top: -2, bottom: -2, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#0b3b66', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
    overflow: 'hidden',
  },
  lensShine: { position: 'absolute', left: 8, right: 8, top: 2, height: '42%', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.6)' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  text: { fontSize: 11, fontWeight: '700', color: C.ink },
  badge: { position: 'absolute', top: -5, right: -10, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#E0445C', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: C.white },
  badgeText: { color: C.white, fontSize: 10, fontWeight: '900' },
});
