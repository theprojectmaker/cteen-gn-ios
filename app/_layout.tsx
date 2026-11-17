import React from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { C } from '../src/theme';
import { LIQUID } from '../src/glass';
import { StoreProvider, useStore } from '../src/store';
import { EventSheet } from '../src/screens';
import { ChallengeSheet } from '../src/rewards';
import { AdminPanel } from '../src/admin';
import { LiveAccessory, useOtaUpdates } from '../src/shell';
import { WebTabs } from '../src/webTabs';

// The tab bar is Apple's own (UITabBarController): real Liquid Glass on iOS 26, with the
// sliding selection, and it shrinks while you scroll down. On the web it is drawn by expo-router.
function Tabs() {
  useOtaUpdates();
  const { liveAlert } = useStore();
  return (
    <>
      <StatusBar style="dark" />
      {Platform.OS === 'web' ? <WebTabs /> : (
      <NativeTabs tintColor={C.blue} minimizeBehavior="onScrollDown" labelStyle={{ fontWeight: '600' }}>
        {liveAlert && LIQUID ? (
          <NativeTabs.BottomAccessory>
            <LiveAccessory alert={liveAlert} />
          </NativeTabs.BottomAccessory>
        ) : null}
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
          <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="events">
          <NativeTabs.Trigger.Icon sf={{ default: 'ticket', selected: 'ticket.fill' }} />
          <NativeTabs.Trigger.Label>Events</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="feed">
          <NativeTabs.Trigger.Icon sf={{ default: 'bubble.left.and.bubble.right', selected: 'bubble.left.and.bubble.right.fill' }} />
          <NativeTabs.Trigger.Label>Feed</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="chapter">
          <NativeTabs.Trigger.Icon sf={{ default: 'person.3', selected: 'person.3.fill' }} />
          <NativeTabs.Trigger.Label>Chapter</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
      )}
      <EventSheet />
      <ChallengeSheet />
      <AdminPanel />
    </>
  );
}

export default function RootLayout() {
  return (
    <StoreProvider>
      <Tabs />
    </StoreProvider>
  );
}
