import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { C, PREFS, T } from '../src/theme';
import { Icon } from '../src/icons';
import { writePrefs } from '../src/prefs';
import { useStore } from '../src/store';
import { Card, IconTile, Toggle } from '../src/ui';
import { Avatar, Page } from '../src/look';

// Profile picture -> Settings: your profile, how the app feels, notifications, about.
// (The Flyer look is dark only, so there is no Appearance choice here.)
export default function SettingsRoute() {
  const { name, grade, age, account, push, turnOnPush, setAdminOpen, leader, signOut, appleReady, signInWithApple, setPhotoAlerts, inboxUnread } = useStore();
  const [appleErr, setAppleErr] = React.useState<string | null>(null);
  const [prefs, setPrefs] = useState({ ...PREFS });

  const update = (patch: Partial<typeof prefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    Object.assign(PREFS, next); // haptics and motion take effect right away
    writePrefs(next);
  };

  return (
    <Page top={60}>
      <Text style={[T.h1, st.title]}>Settings</Text>

      <Card style={st.profile} onPress={() => router.push('/account')} label="Edit your profile">
        <Avatar name={name} size={48} ring={2} />
        <View style={{ flex: 1 }}>
          <Text style={T.h2} numberOfLines={1}>{name || 'Your profile'}</Text>
          <Text style={T.small}>{[grade ? `Grade ${grade}` : '', age ? `Age ${age}` : '', account?.apple ? 'Apple' : account?.google ? 'Google' : ''].filter(Boolean).join(' · ') || 'Tap to set up'}</Text>
        </View>
        <Icon name="right" size={18} color={C.faint} stroke={2.4} />
      </Card>

      <Text style={st.section}>Feel</Text>
      <Card style={st.group}>
        <Row icon="heart" title="Haptics" sub="Little taps when you press things">
          <Toggle value={prefs.haptics} onChange={(v) => update({ haptics: v })} label="Haptics" />
        </Row>
        <Row icon="sun" title="Opening animation" sub="Plays when the app opens" rule>
          <Toggle value={prefs.intro} onChange={(v) => update({ intro: v })} label="Opening animation" />
        </Row>
        <Row icon="clock" title="Reduce motion" sub="Fewer moving effects" rule>
          <Toggle value={prefs.reduceMotion} onChange={(v) => update({ reduceMotion: v })} label="Reduce motion" />
        </Row>
      </Card>

      <Text style={st.section}>Notifications</Text>
      <Card style={st.group}>
        <Row icon="megaphone" title="Inbox" sub={inboxUnread ? `${inboxUnread} new` : 'Every notification, banner and pop-up'} onPress={() => router.push('/inbox')} chevron />
        <Row rule icon="bell" title="Notifications" sub={push === 'on' ? 'On' : push === 'off' ? 'Off. Tap to turn on.' : push === 'blocked' ? "Off in your phone's Settings" : 'Work in the app on your phone'} onPress={push === 'off' ? turnOnPush : undefined}>
          {push === 'on' ? <Icon name="check" size={20} color={C.blue} /> : null}
        </Row>
        <Row icon="camera" title="Tefillin photo alerts" sub="When someone posts their photo" rule>
          <Toggle value={prefs.photoAlerts !== false} onChange={(v) => { update({ photoAlerts: v }); setPhotoAlerts(v); }} label="Tefillin photo alerts" />
        </Row>
      </Card>

      <Text style={st.section}>More</Text>
      <Card style={st.group}>
        <Row icon="user" title="Edit profile" sub="Name, grade, age, sign-in" onPress={() => router.push('/account')} chevron />
        {appleReady && !account?.apple ? <Row icon="lock" title="Link Apple account" sub="Keep your streak and RSVPs on a new phone" onPress={async () => { const e = await signInWithApple(); if (e) setAppleErr(e); }} chevron rule /> : null}
        {appleErr ? <Text style={st.err}>{appleErr}</Text> : null}
        {leader ? <Row icon="lock" title="Leader panel" sub="Post, run challenges, send notifications" onPress={() => setAdminOpen(true)} chevron rule /> : null}
      </Card>

      {account ? (
        <Pressable onPress={signOut} style={st.signOut} accessibilityRole="button">
          <Text style={st.signOutText}>Sign out on this phone</Text>
        </Pressable>
      ) : null}
      <Text style={st.version}>CTeen GN {Constants.expoConfig?.version ?? ''} · Chabad of Great Neck</Text>
    </Page>
  );
}

function Row({ icon, title, sub, children, onPress, rule, chevron }: { icon: string; title: string; sub?: string; children?: React.ReactNode; onPress?: () => void; rule?: boolean; chevron?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [st.row, rule && st.rule, pressed && { backgroundColor: C.raised }]} accessibilityRole={onPress ? 'button' : undefined}>
      <IconTile icon={icon} size={38} />
      <View style={{ flex: 1 }}>
        <Text style={T.strong}>{title}</Text>
        {sub ? <Text style={T.small}>{sub}</Text> : null}
      </View>
      {children}
      {chevron ? <Icon name="right" size={17} color={C.faint} stroke={2.4} /> : null}
    </Pressable>
  );
}

const st = StyleSheet.create({
  title: { marginBottom: 18 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  section: { ...T.eyebrow, marginTop: 28, marginBottom: 10, marginLeft: 2 },
  group: { padding: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  rule: { borderTopWidth: 1, borderTopColor: C.line },
  err: { color: C.red, fontSize: 13, paddingHorizontal: 16, paddingBottom: 12 },
  signOut: { alignSelf: 'center', marginTop: 28, paddingHorizontal: 18, paddingVertical: 12 },
  signOutText: { color: C.red, fontWeight: '700', fontSize: 15 },
  version: { textAlign: 'center', color: C.faint, fontSize: 12, marginTop: 10 },
});
