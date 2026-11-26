import React, { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import { Appearance, Platform, Text, View } from 'react-native';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { C, PREFS, T } from '../src/theme';
import { StoreProvider, useStore } from '../src/store';
import { AdminPanel } from '../src/admin';
import { Setup } from '../src/setup';
import { Intro } from '../src/intro';
import { StartupPopup } from '../src/popup';
import { Tour } from '../src/tour';
import { InviteReminderSync } from '../src/invites';
import { EventReminderSync } from '../src/screens';
import { Composer } from '../src/composer';
import { WrapReminderSync } from '../src/wrapReminders';
import { useOtaUpdates } from '../src/shell';
import { Backdrop, Slab } from '../src/look';

// Browser only: paint the page itself navy right away, so no pale flash shows before the app draws.
if (Platform.OS === 'web') {
  const doc = (globalThis as { document?: { documentElement: { style: { backgroundColor: string } }; body: { style: { backgroundColor: string } } | null } }).document;
  if (doc) {
    doc.documentElement.style.backgroundColor = C.bg;
    if (doc.body) doc.body.style.backgroundColor = C.bg;
  }
}

// The Flyer look is one dark theme: the pieces drawn by the navigation (page backgrounds while
// they slide, the back button) use the same navy and ink.
const NAV_THEME = { ...DarkTheme, colors: { ...DarkTheme.colors, primary: C.blue, background: C.bg, card: C.bg, text: C.ink, border: C.line, notification: C.orange } };

// If anything throws while drawing, show this instead of closing the app.
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 30, backgroundColor: C.bg }}>
      <Backdrop />
      <Text style={T.h1}>Something went wrong</Text>
      <Text style={[T.small, { marginTop: 10 }]}>{String(error?.message || error).slice(0, 200)}</Text>
      <Slab label="Try again" onPress={() => { retry(); }} style={{ marginTop: 24, alignSelf: 'flex-start' }} />
    </View>
  );
}

const page = { headerTransparent: true, headerTitle: '', headerBackTitle: 'Back', headerTintColor: C.ink } as const;

// Tabs at the bottom; other pages slide in on top with a native back button (swipe from the edge to go back).
function Root() {
  useOtaUpdates();
  // Opening animation first (everyone, every launch unless turned off in Settings); the sign-up
  // screen waits for it, so there is never more than one layer opening at the same moment.
  const [introDone, setIntroDone] = useState(false);
  // This look is dark only: make Apple's own pieces (tab bar, sheets, keyboard) dark too, after the first frame.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    try { Appearance.setColorScheme('dark'); } catch {}
  }, []);
  return (
    <ThemeProvider value={NAV_THEME}>
      <StatusBar style="light" />
      <Stack screenOptions={{ contentStyle: { backgroundColor: C.bg }, animation: PREFS.reduceMotion ? 'fade' : 'default', gestureEnabled: true }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="challenge/[id]" options={page} />
        {/* Apple's card pop-up (like Carbix): slides up, the page behind shrinks back, drag down to close. */}
        <Stack.Screen name="event/[id]" options={{ presentation: 'modal', headerShown: false, contentStyle: { backgroundColor: C.bg } }} />
        <Stack.Screen name="post/[id]" options={{ presentation: 'modal', headerShown: false, contentStyle: { backgroundColor: C.bg } }} />
        <Stack.Screen name="challenge-rules/[id]" options={{ presentation: 'modal', headerShown: false, contentStyle: { backgroundColor: C.bg } }} />
        <Stack.Screen name="invite/[id]" options={{ presentation: 'modal', headerShown: false, contentStyle: { backgroundColor: C.bg } }} />
        <Stack.Screen name="challenges" options={page} />
        <Stack.Screen name="account" options={page} />
        <Stack.Screen name="settings" options={page} />
        <Stack.Screen name="inbox" options={page} />
      </Stack>
      <AdminPanel />
      <Composer />
      <WrapReminderSync />
      <InviteReminderSync />
      <EventReminderSync />
      {introDone ? <Setup /> : null}
      <Intro onDone={() => setIntroDone(true)} />
      <StartupPopup ready={introDone} />
      <TourGate ready={introDone} />
    </ThemeProvider>
  );
}

// The quick tour: once, after sign-up, never on top of the leaders' pop-up.
function TourGate({ ready }: { ready: boolean }) {
  const { onboarded, device, tourSeen, content } = useStore();
  if (!ready || !device || !onboarded || tourSeen || content.popup?.on) return null;
  return <Tour />;
}

export default function RootLayout() {
  // The Flyer look's one type family. Wait for it briefly so the first frame looks right, but never more than 1.5s.
  const [fontsReady, fontError] = useFonts({
    BarlowCondensed_600SemiBold: require('../assets/fonts/BarlowCondensed_600SemiBold.ttf'),
    BarlowCondensed_700Bold: require('../assets/fonts/BarlowCondensed_700Bold.ttf'),
    BarlowCondensed_700Bold_Italic: require('../assets/fonts/BarlowCondensed_700Bold_Italic.ttf'),
    BarlowCondensed_800ExtraBold: require('../assets/fonts/BarlowCondensed_800ExtraBold.ttf'),
    BarlowCondensed_800ExtraBold_Italic: require('../assets/fonts/BarlowCondensed_800ExtraBold_Italic.ttf'),
    BarlowCondensed_900Black_Italic: require('../assets/fonts/BarlowCondensed_900Black_Italic.ttf'),
  });
  const [waited, setWaited] = useState(false);
  useEffect(() => { const t = setTimeout(() => setWaited(true), 1500); return () => clearTimeout(t); }, []);
  if (!fontsReady && !fontError && !waited) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  return (
    <StoreProvider>
      <Root />
    </StoreProvider>
  );
}
