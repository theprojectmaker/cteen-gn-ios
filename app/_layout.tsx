import React, { useEffect, useState } from 'react';
import { useFonts, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { Appearance, Platform, Pressable, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { C, IS_DARK, PREFS, F } from '../src/theme';
import { StoreProvider, useStore } from '../src/store';
import { AdminPanel } from '../src/admin';
import { Setup } from '../src/setup';
import { Intro } from '../src/intro';
import { useOtaUpdates } from '../src/shell';

// If anything throws while drawing, show this instead of closing the app.
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, backgroundColor: C.bg }}>
      <Text style={{ fontSize: 22, fontFamily: F.display, color: C.ink, textAlign: 'center' }}>Something went wrong</Text>
      <Text style={{ fontSize: 14, color: C.sub, textAlign: 'center', marginTop: 8 }}>{String(error?.message || error).slice(0, 200)}</Text>
      <Pressable onPress={() => { retry(); }} style={{ marginTop: 22, paddingHorizontal: 26, height: 48, borderRadius: 24, backgroundColor: C.blue, justifyContent: 'center' }} accessibilityRole="button">
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Try again</Text>
      </Pressable>
    </View>
  );
}

const page = { headerTransparent: true, headerTitle: '', headerBackTitle: 'Back', headerTintColor: C.ink } as const;

// Tabs at the bottom; other pages slide in on top with a native back button (swipe from the edge to go back).
function Root() {
  useOtaUpdates();
  const { onboarded, device } = useStore();
  // Make Apple's own pieces (tab bar, sheets, keyboard) follow Settings > Appearance, after the first frame.
  useEffect(() => {
    if (Platform.OS === 'web' || PREFS.theme === 'system') return;
    try { Appearance.setColorScheme(PREFS.theme); } catch {}
  }, []);
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
      {device && onboarded ? <Intro /> : null}
    </>
  );
}

export default function RootLayout() {
  // Headline font. Wait for it briefly so the first frame looks right, but never more than 1.5s.
  const [fontsReady, fontError] = useFonts({ BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold });
  const [waited, setWaited] = useState(false);
  useEffect(() => { const t = setTimeout(() => setWaited(true), 1500); return () => clearTimeout(t); }, []);
  if (!fontsReady && !fontError && !waited) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  return (
    <StoreProvider>
      <Root />
    </StoreProvider>
  );
}
