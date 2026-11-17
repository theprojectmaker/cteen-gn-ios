import React, { useEffect, useState } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, R, T } from './theme';
import { Icon } from './icons';
import { useStore, type Gender } from './store';
import { Button, Card, Field, s as u } from './ui';

const GRADES = ['8', '9', '10', '11', '12'];
const AGES = [12, 13, 14, 15, 16, 17, 18];
const GENDERS: { v: Gender; l: string }[] = [{ v: 'boy', l: 'Boy' }, { v: 'girl', l: 'Girl' }];

function ChipRow<V extends string | number>({ label, options, value, onChange, hint }: { label: string; options: { v: V; l: string }[]; value: V | null; onChange: (v: V) => void; hint?: string }) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={u.fieldLabel}>{label}</Text>
      <View style={u.chipsFlow}>
        {options.map((o) => {
          const on = o.v === value;
          return (
            <Pressable key={String(o.v)} onPress={() => onChange(o.v)} style={[u.chip, st.chip, on && u.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${label}: ${o.l}`}>
              <Text style={[u.chipText, on && u.chipTextOn]}>{o.l}</Text>
            </Pressable>
          );
        })}
      </View>
      {hint ? <Text style={[T.small, { marginTop: 6, fontSize: 12 }]}>{hint}</Text> : null}
    </View>
  );
}

// Name, grade, age and gender. Age and gender decide which special events (like a girls' night) you see.
export function ProfileForm({ cta, onSaved }: { cta: string; onSaved?: () => void }) {
  const { name, grade, age, gender, saveProfile } = useStore();
  const [n, setN] = useState(name);
  const [g, setG] = useState(grade);
  const [a, setA] = useState<number | null>(age);
  const [s, setS] = useState<Gender>(gender);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setN(name); setG(grade); setA(age); setS(gender); }, [name, grade, age, gender]);
  const save = async () => {
    setBusy(true); setErr(null);
    const e = await saveProfile({ name: n, grade: g, age: a, gender: s });
    setBusy(false);
    if (e) return setErr(e);
    onSaved?.();
  };
  return (
    <View>
      <Field label="Your name" value={n} onChange={setN} placeholder="Like: Noah S." hint="First name and last initial is perfect." />
      <ChipRow label="Grade" options={GRADES.map((x) => ({ v: x, l: `${x}th` }))} value={g || null} onChange={setG} />
      <ChipRow label="Age" options={AGES.map((x) => ({ v: x, l: x === 18 ? '18+' : String(x) }))} value={a} onChange={setA} />
      <ChipRow label="I'm a" options={GENDERS} value={s || null} onChange={setS} hint="Used only to show you events made for you, like a girls' or boys' night." />
      {err ? <Text style={st.err}>{err}</Text> : null}
      <View style={{ marginTop: 24 }}>
        <Button label={busy ? 'Saving…' : cta} disabled={busy || n.trim().length < 2} onPress={save} />
      </View>
    </View>
  );
}

function AppleRow() {
  const { account, appleReady, signInWithApple } = useStore();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!appleReady) return null;
  if (account?.apple) {
    return (
      <View style={[st.row, { marginBottom: 16 }]}>
        <View style={[st.gBadge, { backgroundColor: '#000' }]}><Text style={[st.gLetter, { color: '#fff' }]}>{''}</Text></View>
        <Text style={[T.h3, { flex: 1 }]}>Signed in with Apple</Text>
        <Icon name="check" size={20} color={C.green} />
      </View>
    );
  }
  return (
    <View style={{ marginBottom: 16 }}>
      <Pressable onPress={async () => { setBusy(true); setErr(await signInWithApple()); setBusy(false); }} disabled={busy} style={({ pressed }) => [st.gButton, { backgroundColor: '#000', borderColor: '#000' }, pressed && u.pressed]} accessibilityRole="button" accessibilityLabel="Sign in with Apple">
        <Text style={{ color: '#fff', fontSize: 20, marginTop: -2 }}>{''}</Text>
        <Text style={[st.gText, { color: '#fff' }]}>{busy ? 'Opening…' : 'Sign in with Apple'}</Text>
      </Pressable>
      {err ? <Text style={st.err}>{err}</Text> : null}
    </View>
  );
}

function GoogleRow() {
  const { account, googleReady, linkGoogle } = useStore();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (account?.google) {
    return (
      <View style={st.row}>
        <View style={st.gBadge}><Text style={st.gLetter}>G</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={T.h3}>Linked with Google</Text>
          <Text style={T.small} numberOfLines={1}>{account.google.email}</Text>
        </View>
        <Icon name="check" size={20} color={C.green} />
      </View>
    );
  }
  return (
    <View>
      <Pressable
        onPress={async () => { setBusy(true); setErr(await linkGoogle()); setBusy(false); }}
        disabled={!googleReady || busy || Platform.OS === 'web'}
        style={({ pressed }) => [st.gButton, (!googleReady || Platform.OS === 'web') && { opacity: 0.5 }, pressed && u.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Link with Google">
        <View style={st.gBadge}><Text style={st.gLetter}>G</Text></View>
        <Text style={st.gText}>{busy ? 'Opening Google…' : 'Link with Google'}</Text>
      </Pressable>
      <Text style={[T.small, { marginTop: 8, fontSize: 12 }]}>
        {Platform.OS === 'web' ? 'Google linking works in the app on your phone.' : googleReady ? 'Keeps your streaks and sign-ups if you get a new phone.' : 'Google linking is coming soon.'}
      </Text>
      {err ? <Text style={st.err}>{err}</Text> : null}
    </View>
  );
}

// app/account.tsx
export function AccountPage() {
  const { name, account, signOut } = useStore();
  const [saved, setSaved] = useState(false);
  return (
    <View>
      <View style={st.head}>
        <View style={st.avatarBig}>
          {name ? <Text style={st.avatarLetter}>{name[0].toUpperCase()}</Text> : <Icon name="user" size={34} color={C.white} />}
        </View>
        <Text style={st.title}>{name || 'Your account'}</Text>
        <Text style={[T.small, { marginTop: 4 }]}>{account ? 'Saved to your CTeen GN account' : 'Not saved yet'}</Text>
      </View>
      <Card style={{ padding: 20 }}>
        <ProfileForm cta={saved ? 'Saved' : 'Save'} onSaved={() => setSaved(true)} />
      </Card>
      <Text style={st.section}>Sign in</Text>
      <Card style={{ padding: 20 }}>
        <AppleRow />
        <GoogleRow />
      </Card>
      {account ? (
        <Pressable onPress={signOut} hitSlop={8} style={{ alignSelf: 'center', marginTop: 28 }} accessibilityRole="button">
          <Text style={[T.small, { textDecorationLine: 'underline' }]}>Sign out on this phone</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  chip: { minWidth: 56, ...{ shadowOpacity: 0 } },
  err: { color: '#C0303F', fontWeight: '700', fontSize: 13, marginTop: 12 },
  head: { alignItems: 'center', paddingTop: 8, paddingBottom: 24 },
  avatarBig: { width: 84, height: 84, borderRadius: 42, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: C.white, fontSize: 36, fontWeight: '900' },
  title: { fontSize: 28, fontWeight: '900', color: C.ink, marginTop: 14, letterSpacing: -0.4 },
  section: { fontSize: 19, fontWeight: '900', color: C.ink, marginTop: 30, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  gButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 50, borderRadius: R.pill, borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
  gBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#F1F3F4', alignItems: 'center', justifyContent: 'center' },
  gLetter: { fontSize: 15, fontWeight: '900', color: '#4285F4' },
  gText: { fontSize: 16, fontWeight: '800', color: C.ink },
  logo: { width: 72, height: 72, borderRadius: 18 },
  welcome: { fontSize: 30, lineHeight: 34, fontWeight: '900', color: C.ink, marginTop: 18, letterSpacing: -0.5 },
});
