import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';
import { C } from './theme';
import { Icon } from './icons';
import { Glass } from './glass';

// Browser preview only: a floating frosted tab bar at the bottom, shaped like the
// iPhone's Liquid Glass bar. Phones use Apple's own tab bar (see app/_layout.tsx).
const ITEMS: Record<string, { label: string; icon: string }> = {
  index: { label: 'Home', icon: 'home' },
  events: { label: 'Events', icon: 'ticket' },
  feed: { label: 'Feed', icon: 'chat' },
  chapter: { label: 'Chapter', icon: 'users' },
};

type BarProps = { state: { index: number; routes: { key: string; name: string }[] }; navigation: { navigate: (name: string) => void } };

function GlassBar({ state, navigation }: BarProps) {
  return (
    <View style={st.wrap} pointerEvents="box-none">
      <Glass style={st.bar}>
        {state.routes.map((r, i) => {
          const item = ITEMS[r.name];
          if (!item) return null;
          const on = state.index === i;
          return (
            <Pressable key={r.key} onPress={() => navigation.navigate(r.name)} style={[st.tab, on && st.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={item.label}>
              <Icon name={item.icon} size={22} color={on ? C.blue : C.ink} stroke={on ? 2.3 : 1.8} />
              <Text style={[st.text, on && { color: C.blue }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </Glass>
    </View>
  );
}

export function WebTabs() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(p) => <GlassBar {...(p as unknown as BarProps)} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="events" />
      <Tabs.Screen name="feed" />
      <Tabs.Screen name="chapter" />
    </Tabs>
  );
}

const st = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 14, alignItems: 'center', paddingHorizontal: 20 },
  bar: { flexDirection: 'row', borderRadius: 34, padding: 6, width: '100%', maxWidth: 420, overflow: 'hidden' },
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 8, borderRadius: 28 },
  tabOn: { backgroundColor: 'rgba(21,159,220,0.12)' },
  text: { fontSize: 11, fontWeight: '700', color: C.ink },
});
