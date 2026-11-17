import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { C } from '../src/theme';
import { StoreProvider } from '../src/store';
import { AdminPanel } from '../src/admin';
import { Setup } from '../src/setup';
import { useOtaUpdates } from '../src/shell';

// Tabs at the bottom; the challenge and account pages slide in on top with a native back button.
function Root() {
  useOtaUpdates();
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ contentStyle: { backgroundColor: C.bg } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="challenge/[id]" options={{ headerTransparent: true, headerTitle: '', headerBackTitle: 'Back', headerTintColor: C.ink }} />
        {/* Apple's slide-up sheet: grab pill on top, drag down to close, half or full height. */}
        <Stack.Screen name="event/[id]" options={{ presentation: 'formSheet', sheetGrabberVisible: true, sheetAllowedDetents: [0.75, 1], sheetCornerRadius: 28, headerShown: false, contentStyle: { backgroundColor: C.bg } }} />
        <Stack.Screen name="challenges" options={{ headerTransparent: true, headerTitle: '', headerBackTitle: 'Back', headerTintColor: C.ink }} />
        <Stack.Screen name="account" options={{ headerTransparent: true, headerTitle: '', headerBackTitle: 'Back', headerTintColor: C.ink }} />
      </Stack>
      <AdminPanel />
      <Setup />
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
