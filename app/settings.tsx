import React, { useState } from 'react';
import { DevSettings, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { C, PREFS, R, T, F } from '../src/theme';
import { Icon } from '../src/icons';
import { writePrefs, type ThemeMode } from '../src/prefs';
import { useStore } from '../src/store';
import { Card, IconTile, Toggle } from '../src/ui';

// Profile picture -> Settings: your profile, appearance, how the app feels, notifications, about.
export default function SettingsRoute() {
  const insets = useSafeAreaInsets();
  const { name, grade, age, account, push, turnOnPush, setAdminOpen, leader, signOut, appleReady, signInWithApple } = useStore();
  const [appleErr, setAppleErr] = React.useState<string | null>(null);
  const [prefs, setPrefs] = useState({ ...PREFS });
  const [restartNote, setRestartNote] = useState(false);

  const update = (patch: Partial<typeof prefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    Object.assign(PREFS, next); // haptics and motion take effect right away
    writePrefs(next);
  };
  const setTheme = (theme: ThemeMode) => {
    if (theme === prefs.theme) return;
    update({ theme });
    setRestartNote(true);
    // Colors are picked at startup, so restart the app to redraw everything.
    setTimeout(() => {
      if (Platform.OS === 'web') { (globalThis as any).location?.reload(); return; }
      if (__DEV__) DevSettings.reload();
      else Updates.reloadAsync().catch(() => DevSettings.reload());
    }, 350);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }}>
      <View style={st.col}>
        <Text style={st.title}>Settings</Text>

        <Card style={st.profile} onPress={() => router.push('/account')} label="Edit your profile">
          <View style={st.avatar}><Text style={st.avatarText}>{name ? name[0].toUpperCase() : '?'}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={T.h2}>{name || 'Your profile'}</Text>
            <Text style={T.small}>{[grade ? `Grade ${grade}` : '', age ? `Age ${age}` : '', account?.apple ? 'Apple' : account?.google ? 'Google' : ''].filter(Boolean).join(' · ') || 'Tap to set up'}</Text>
          </View>
          <Icon name="right" size={18} color={C.faint} stroke={2.4} />
        </Card>

        <Text style={st.section}>Appearance</Text>
        <Card style={{ padding: 6 }}>
          <View style={st.seg}>
            {([['light', 'Light', 'sun'], ['dark', 'Dark', 'star'], ['system', 'Match phone', 'phone']] as const).map(([v, l, icon]) => {
              const on = prefs.theme === v;
              return (
                <Pressable key={v} onPress={() => setTheme(v)} style={[st.segBtn, on && st.segOn]} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`Appearance: ${l}`}>
                  <Icon name={icon} size={18} color={on ? C.onInverse : C.ink} stroke={2} />
                  <Text style={[st.segText, on && { color: C.onInverse }]}>{l}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
        {restartNote ? <Text style={[T.small, { marginTop: 8, textAlign: 'center' }]}>Restarting to apply…</Text> : null}

        <Text style={st.section}>Feel</Text>
        <Card style={{ padding: 0 }}>
          <Row icon="heart" color="pink" title="Haptics" sub="Little taps when you press things">
            <Toggle value={prefs.haptics} onChange={(v) => update({ haptics: v })} label="Haptics" />
          </Row>
          <Row icon="sun" color="yellow" title="Opening animation" sub="Plays when the app opens" rule>
            <Toggle value={prefs.intro} onChange={(v) => update({ intro: v })} label="Opening animation" />
          </Row>
          <Row icon="clock" color="purple" title="Reduce motion" sub="Fewer moving effects" rule>
            <Toggle value={prefs.reduceMotion} onChange={(v) => update({ reduceMotion: v })} label="Reduce motion" />
          </Row>
        </Card>

        <Text style={st.section}>Notifications</Text>
        <Card style={{ padding: 0 }}>
          <Row icon="bell" color="blue" title="Notifications" sub={push === 'on' ? 'On' : push === 'off' ? 'Off. Tap to turn on.' : push === 'blocked' ? "Off in your phone's Settings" : 'Work in the app on your phone'} onPress={push === 'off' ? turnOnPush : undefined}>
            {push === 'on' ? <Icon name="check" size={20} color={C.green} /> : null}
          </Row>
        </Card>

        <Text style={st.section}>More</Text>
        <Card style={{ padding: 0 }}>
          <Row icon="user" color="green" title="Edit profile" sub="Name, grade, age, sign-in" onPress={() => router.push('/account')} chevron />
          {appleReady && !account?.apple ? <Row icon="lock" color="blue" title="Link Apple account" sub="Keep your streak and RSVPs on a new phone" onPress={async () => { const e = await signInWithApple(); if (e) setAppleErr(e); }} chevron rule /> : null}
          {appleErr ? <Text style={{ color: '#C0303F', fontSize: 13, paddingHorizontal: 16, paddingBottom: 12 }}>{appleErr}</Text> : null}
          <Row icon="lock" color="orange" title={leader ? 'Leader panel' : 'Leader sign-in'} sub="For Rabbi Zevy and chapter leaders" onPress={() => setAdminOpen(true)} chevron rule />
        </Card>

        {account ? (
          <Pressable onPress={signOut} style={st.signOut} accessibilityRole="button">
            <Text style={st.signOutText}>Sign out on this phone</Text>
          </Pressable>
        ) : null}
        <Text style={st.version}>CTeen GN {Constants.expoConfig?.version ?? ''} · Chabad of Great Neck</Text>
      </View>
    </ScrollView>
  );
}

function Row({ icon, color, title, sub, children, onPress, rule, chevron }: { icon: string; color: 'blue' | 'orange' | 'purple' | 'green' | 'pink' | 'yellow'; title: string; sub?: string; children?: React.ReactNode; onPress?: () => void; rule?: boolean; chevron?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [st.row, rule && st.rule, pressed && { backgroundColor: C.bg }]} accessibilityRole={onPress ? 'button' : undefined}>
      <IconTile icon={icon} color={color} size={38} />
      <View style={{ flex: 1 }}>
        <Text style={T.h3}>{title}</Text>
        {sub ? <Text style={T.small}>{sub}</Text> : null}
      </View>
      {children}
      {chevron ? <Icon name="right" size={17} color={C.faint} stroke={2.4} /> : null}
    </Pressable>
  );
}

const st = StyleSheet.create({
  col: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20 },
  title: { fontSize: 34, fontFamily: F.display, color: C.ink, letterSpacing: -0.7, marginBottom: 18 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.white, fontSize: 24, fontFamily: F.display },
  section: { fontSize: 13, fontWeight: '800', color: C.sub, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 28, marginBottom: 10, marginLeft: 4 },
  seg: { flexDirection: 'row', gap: 6 },
  segBtn: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: 14 },
  segOn: { backgroundColor: C.inverse },
  segText: { fontSize: 13, fontWeight: '800', color: C.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  rule: { borderTopWidth: 1, borderTopColor: C.line },
  signOut: { alignSelf: 'center', marginTop: 28, paddingHorizontal: 18, paddingVertical: 10, borderRadius: R.pill },
  signOutText: { color: '#D2384A', fontWeight: '800', fontSize: 15 },
  version: { textAlign: 'center', color: C.faint, fontSize: 12, marginTop: 10 },
});
