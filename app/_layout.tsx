import React from 'react';
import { Appearance, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { C, IS_DARK, PREFS } from '../src/theme';
import { StoreProvider } from '../src/store';
import { AdminPanel } from '../src/admin';
import { Setup } from '../src/setup';
import { Intro } from '../src/intro';
import { useOtaUpdates } from '../src/shell';

// Make Apple's own pieces (tab bar, sheets, keyboard) follow Settings > Appearance too.
if (Platform.OS !== 'web') {
  try { Appearance.setColorScheme(PREFS.theme === 'system' ? 'unspecified' : PREFS.theme); } catch {}
}

const page = { headerTransparent: true, headerTitle: '', headerBackTitle: 'Back', headerTintColor: C.ink } as const;

// Tabs at the bottom; other pages slide in on top with a native back button (swipe from the edge to go back).
function Root() {
  useOtaUpdates();
  return (
    <>
      <StatusBar style={IS_DARK ? 'light' : 'dark'} />
      <Stack screenOptions={{ contentStyle: { backgroundColor: C.bg }, animation: PREFS.reduceMotion ? 'fade' : 'default', gestureEnabled: true }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="challenge/[id]" options={page} />
        {/* Apple's card pop-up (like Carbix): slides up, the page behind shrinks back, drag down to close. */}
        <Stack.Screen name="event/[id]" options={{ presentation: 'modal', headerShown: false, contentStyle: { backgroundColor: C.bg } }} />
        <Stack.Screen name="post/[id]" options={{ presentation: 'modal', headerShown: false, contentStyle: { backgroundColor: C.bg } }} />
        <Stack.Screen name="challenges" options={page} />
        <Stack.Screen name="account" options={page} />
        <Stack.Screen name="settings" options={page} />
      </Stack>
      <AdminPanel />
      <Setup />
      <Intro />
    </>
  );
}

export default function RootLayout() {
  return (
    <StoreProvider>
      <Root />
    </StoreProvider>
  );
}
