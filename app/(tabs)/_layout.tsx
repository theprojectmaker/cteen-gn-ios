import React from 'react';
import { Platform } from 'react-native';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { C } from '../../src/theme';
import { LIQUID } from '../../src/glass';
import { useStore } from '../../src/store';
import { LiveAccessory } from '../../src/shell';
import { WebTabs } from '../../src/webTabs';

// The tab bar is Apple's own (UITabBarController): real Liquid Glass on iOS 26, with the
// sliding selection, and it shrinks while you scroll down. The web preview draws its own.
export default function TabsLayout() {
  const { liveAlert, unreadFeed, newEvents } = useStore();
  if (Platform.OS === 'web') return <WebTabs />;
  return (
    <NativeTabs tintColor={C.blue} minimizeBehavior="onScrollDown" labelStyle={{ fontWeight: '600' }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="events">
        <NativeTabs.Trigger.Icon sf={{ default: 'ticket', selected: 'ticket.fill' }} />
        <NativeTabs.Trigger.Label>Events</NativeTabs.Trigger.Label>
        {newEvents > 0 ? <NativeTabs.Trigger.Badge>{String(newEvents)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="calendar">
        <NativeTabs.Trigger.Icon sf={{ default: 'calendar', selected: 'calendar' }} />
        <NativeTabs.Trigger.Label>Calendar</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="feed">
        <NativeTabs.Trigger.Icon sf={{ default: 'bubble.left.and.bubble.right', selected: 'bubble.left.and.bubble.right.fill' }} />
        <NativeTabs.Trigger.Label>Feed</NativeTabs.Trigger.Label>
        {unreadFeed > 0 ? <NativeTabs.Trigger.Badge>{String(unreadFeed)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chapter">
        <NativeTabs.Trigger.Icon sf={{ default: 'person.3', selected: 'person.3.fill' }} />
        <NativeTabs.Trigger.Label>Chapter</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
