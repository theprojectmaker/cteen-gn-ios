import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { C } from '../src/theme';
import { StoreProvider } from '../src/store';
import { EventSheet } from '../src/screens';
import { AdminPanel } from '../src/admin';
import { Onboarding } from '../src/account';
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
        <Stack.Screen name="account" options={{ headerTransparent: true, headerTitle: '', headerBackTitle: 'Back', headerTintColor: C.ink }} />
      </Stack>
      <EventSheet />
      <AdminPanel />
      <Onboarding />
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
