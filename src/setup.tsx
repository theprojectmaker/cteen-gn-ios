import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, R, F } from './theme';
import { Icon } from './icons';
import { tap, useStore, type Gender } from './store';

// First-launch setup (required to use the app): one question per screen, big tap targets,
// a progress bar, and a finish screen. Everything can be changed later from the account page.
const GRADES = ['8', '9', '10', '11', '12'];
const AGES = [12, 13, 14, 15, 16, 17, 18];
const STEPS = 4; // after the welcome screen: name, about you, notifications, done

function Progress({ step }: { step: number }) {
  return (
    <View style={st.progress} accessibilityLabel={`Step ${step} of ${STEPS}`}>
      {[...Array(STEPS)].map((_, i) => (
        <View key={i} style={[st.seg, { backgroundColor: i < step ? C.blue : C.line }]} />
      ))}
    </View>
  );
}

function Choice({ label, sub, on, onPress, icon }: { label: string; sub?: string; on: boolean; onPress: () => void; icon?: string }) {
  return (
    <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => [st.choice, on && st.choiceOn, pressed && { transform: [{ scale: 0.985 }] }]} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={label}>
      {icon ? (
        <View style={[st.choiceIcon, on && { backgroundColor: C.blue }]}>
          <Icon name={icon} size={20} color={on ? C.white : C.blueDeep} stroke={2} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[st.choiceText, on && { color: C.blueDeep }]}>{label}</Text>
        {sub ? <Text style={st.choiceSub}>{sub}</Text> : null}
      </View>
      <View style={[st.radio, on && st.radioOn]}>{on ? <Icon name="tick" size={13} color={C.white} stroke={3} /> : null}</View>
    </Pressable>
  );
}

function Pill({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={() => { tap(); onPress(); }} style={[st.pill, on && st.pillOn]} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={label}>
      <Text style={[st.pillText, on && { color: C.white }]}>{label}</Text>
    </Pressable>
  );
}

export function Setup() {
  const insets = useSafeAreaInsets();
  const store = useStore();
  const { device, onboarded, name: savedName, finishOnboarding, saveProfile, push, turnOnPush, googleReady, linkGoogle, appleReady, signInWithApple } = store;
  const [step, setStep] = useState(0);
  const [name, setName] = useState(savedName);
  const [grade, setGrade] = useState(store.grade);
  const [age, setAge] = useState<number | null>(store.age);
  const [gender, setGender] = useState<Gender>(store.gender);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fade = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(0)).current;

  // Required: shows until the last screen sets onboarded. Someone who skipped setup in an older
  // version (onboarded but no name) is sent through it again.
  useEffect(() => {
    if (device && onboarded && !savedName) store.restartOnboarding();
  }, [device, onboarded, savedName]);
  const done = () => finishOnboarding();
  const show = !!device && !onboarded;
  useEffect(() => {
    fade.setValue(0); slide.setValue(24);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(slide, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  }, [step]);
  if (!show) return null;

  const first = name.trim().split(' ')[0];
  const go = (n: number) => { setErr(null); tap(); setStep(n); };
  const saveAndNext = async () => {
    setBusy(true); setErr(null);
    const e = await saveProfile({ name, grade, age, gender });
    setBusy(false);
    if (e) return setErr(e);
    go(3);
  };

  const canNext = [true, name.trim().length >= 2, !!grade && age != null && !!gender, true, true][step];
  let body: React.ReactNode;
  let cta = 'Continue';
  let onCta: () => void = () => go(step + 1);

  if (step === 0) {
    // Welcome: real photos from the chapter, the logo, one plain line, and the sign-up buttons.
    return (
      <Modal visible animationType="fade" onRequestClose={() => {}} statusBarTranslucent>
        <View style={[st.welcome, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }]}>
          <Animated.View style={[st.photos, { opacity: fade }]}>
            <Image source={require('../assets/welcome/UDxu12904575.jpg')} style={[st.ph, st.phTall]} resizeMode="cover" accessibilityLabel="CTeen Great Neck teens" />
            <View style={st.phCol}>
              <Image source={require('../assets/welcome/Kkbw12904573.jpg')} style={[st.ph, st.phHalf]} resizeMode="cover" accessibilityLabel="Girls' night at CTeen Great Neck" />
              <Image source={require('../assets/welcome/mwvp12904577.jpg')} style={[st.ph, st.phHalf]} resizeMode="cover" accessibilityLabel="Rabbi Zevy teaching a class" />
            </View>
          </Animated.View>
          <Animated.View style={[st.welcomeText, { opacity: fade, transform: [{ translateY: slide }] }]}>
            <View style={st.brandRow}>
              <Image source={require('../assets/logo.png')} style={st.brandLogo} resizeMode="contain" />
              <Text style={st.brandName}>CTeen Great Neck</Text>
            </View>
            <Text style={st.welcomeLine}>The teen chapter at Chabad of Great Neck, with Rabbi Zevy and Shani Geisinsky.</Text>
          </Animated.View>
          <View style={st.welcomeButtons}>
            {appleReady ? (
              <Pressable
                onPress={async () => {
                  setErr(null);
                  const e = await signInWithApple();
                  if (e) return setErr(e);
                  const n = store.name || '';
                  setName((cur) => cur || n);
                  go(n.trim().length >= 2 ? 2 : 1);
                }}
                style={({ pressed }) => [st.appleBtn, pressed && { opacity: 0.9 }]}
                accessibilityRole="button"
                accessibilityLabel="Continue with Apple">
                <Text style={st.appleLogo}>{''}</Text>
                <Text style={st.appleText}>Continue with Apple</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => go(1)} style={({ pressed }) => [st.nameBtn, pressed && { opacity: 0.85 }]} accessibilityRole="button">
              <Text style={st.nameBtnText}>{appleReady ? 'Sign up with your name' : 'Sign up'}</Text>
            </Pressable>
            {googleReady && Platform.OS !== 'web' ? (
              <Pressable onPress={async () => { const e = await linkGoogle(); if (e) setErr(e); }} hitSlop={8} style={{ marginTop: 14, alignSelf: 'center' }} accessibilityRole="button">
                <Text style={st.signInLink}>I already have an account</Text>
              </Pressable>
            ) : null}
            {err ? <Text style={st.err}>{err}</Text> : null}
          </View>
        </View>
      </Modal>
    );
  }

  if (step === 1) {
    body = (
      <>
        <Text style={st.q}>What's your name?</Text>
        <Text style={st.qSub}>First name and last initial. It shows on event sign-ups and the leaderboard.</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Noah S."
          placeholderTextColor={C.faint}
          autoFocus
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => canNext && go(2)}
          style={st.bigInput}
          accessibilityLabel="Your name"
        />
      </>
    );
  } else if (step === 2) {
    cta = busy ? 'Saving…' : 'Continue';
    onCta = saveAndNext;
    body = (
      <>
        <Text style={st.q}>A bit about you{first ? `, ${first}` : ''}</Text>
        <Text style={st.qSub}>Some events are for a certain age, or are a girls' or boys' night. This makes sure you see the right ones.</Text>
        <Text style={st.label}>Grade</Text>
        <View style={st.pills}>
          {GRADES.map((g) => <Pill key={g} label={`${g}th`} on={grade === g} onPress={() => setGrade(g)} />)}
        </View>
        <Text style={st.label}>Age</Text>
        <View style={st.pills}>
          {AGES.map((a) => <Pill key={a} label={a === 18 ? '18+' : String(a)} on={age === a} onPress={() => setAge(a)} />)}
        </View>
        <Text style={st.label}>I'm a</Text>
        <View style={{ gap: 10 }}>
          <Choice label="Boy" icon="user" on={gender === 'boy'} onPress={() => setGender('boy')} />
          <Choice label="Girl" icon="user" on={gender === 'girl'} onPress={() => setGender('girl')} />
        </View>
        <View style={st.privacy}>
          <Icon name="lock" size={16} color={C.sub} stroke={2} />
          <Text style={st.privacyText}>Only Rabbi Zevy and chapter leaders can see this. It is never shown to other teens.</Text>
        </View>
      </>
    );
  } else if (step === 3) {
    const native = push !== 'unsupported';
    cta = native && push === 'off' ? 'Turn on notifications' : 'Continue';
    onCta = native && push === 'off' ? async () => { await turnOnPush(); go(4); } : () => go(4);
    body = (
      <View style={{ alignItems: 'center', paddingTop: 24 }}>
        <View style={st.bellWrap}>
          <Icon name="bell" size={52} color={C.white} stroke={1.8} />
        </View>
        <Text style={[st.q, { textAlign: 'center', marginTop: 28 }]}>Don't miss a thing</Text>
        <Text style={[st.qSub, { textAlign: 'center' }]}>Get a heads-up when sign-ups open, when plans change, and when it's time to keep your streak.</Text>
        {push === 'on' ? <Text style={[st.qSub, { color: C.green, fontWeight: '700' }]}>Notifications are on.</Text> : null}
        {push === 'unsupported' ? <Text style={[st.qSub, { fontSize: 13 }]}>Notifications work in the app on your phone.</Text> : null}
      </View>
    );
  } else {
    cta = "Let's go";
    onCta = () => { tap(true); done(); };
    body = (
      <View style={{ alignItems: 'center', paddingTop: 24 }}>
        <View style={[st.bellWrap, { backgroundColor: C.green }]}>
          <Icon name="tick" size={54} color={C.white} stroke={2.6} />
        </View>
        <Text style={[st.q, { textAlign: 'center', marginTop: 28 }]}>You're in{first ? `, ${first}` : ''}</Text>
        <Text style={[st.qSub, { textAlign: 'center' }]}>Welcome to CTeen Great Neck. Here's your profile.</Text>
        <View style={st.summary}>
          {[name.trim(), grade ? `${grade}th grade` : '', age ? `Age ${age === 18 ? '18+' : age}` : ''].filter(Boolean).map((t) => (
            <View key={t} style={st.tag}><Text style={st.tagText}>{t}</Text></View>
          ))}
        </View>
        <Text style={[st.qSub, { fontSize: 13, textAlign: 'center' }]}>You can change any of this from your account.</Text>
      </View>
    );
  }

  return (
    <Modal visible animationType="fade" onRequestClose={() => step > 1 && step < 4 && go(step - 1)}>
      <KeyboardAvoidingView behavior={undefined} style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={[st.top, { paddingTop: insets.top + 10 }]}>
          <Pressable onPress={() => go(step - 1)} hitSlop={10} style={st.back} accessibilityRole="button" accessibilityLabel="Back" disabled={step >= 4}>
            {step < 4 ? <Icon name="right" size={20} color={C.ink} stroke={2.4} /> : null}
          </Pressable>
          <Progress step={step} />
          <View style={{ width: 44 }} />
        </View>
        <ScrollView automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive" contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled">
          <Animated.View style={{ opacity: fade, transform: [{ translateX: slide }] }}>{body}</Animated.View>
          {err ? <Text style={st.err}>{err}</Text> : null}
        </ScrollView>
        <View style={[st.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable onPress={onCta} disabled={!canNext || busy} style={({ pressed }) => [st.cta, (!canNext || busy) && { opacity: 0.4 }, pressed && { opacity: 0.85 }]} accessibilityRole="button" accessibilityState={{ disabled: !canNext || busy }}>
            <Text style={st.ctaText}>{cta}</Text>
          </Pressable>
          {step === 3 && push === 'off' ? (
            <Pressable onPress={() => go(4)} hitSlop={8} style={{ alignSelf: 'center', marginTop: 14 }} accessibilityRole="button">
              <Text style={st.skip}>Not now</Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}


const st = StyleSheet.create({
  welcome: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 20 },
  photos: { flexDirection: 'row', justifyContent: 'space-between', height: 400, width: '100%', maxWidth: 560, alignSelf: 'center' },
  phCol: { width: '48.5%', height: '100%', justifyContent: 'space-between' },
  ph: { borderRadius: 22, backgroundColor: C.line },
  phTall: { width: '48.5%', height: '100%' },
  phHalf: { width: '100%', height: '48.8%' },
  welcomeText: { marginTop: 26, width: '100%', maxWidth: 560, alignSelf: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandLogo: { width: 26, height: 46 },
  brandName: { fontSize: 32, fontFamily: F.display, color: C.ink, letterSpacing: -0.8 },
  welcomeLine: { fontSize: 17, lineHeight: 24, color: C.sub, marginTop: 10 },
  welcomeButtons: { marginTop: 'auto', paddingTop: 24, width: '100%', maxWidth: 560, alignSelf: 'center', gap: 10 },
  nameBtn: { minHeight: 56, borderRadius: R.pill, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  nameBtnText: { color: C.white, fontSize: 18, fontWeight: '800' },
  signInLink: { color: C.blueDeep, fontSize: 15, fontWeight: '700' },
  hero: { flex: 1, backgroundColor: '#1186c8', paddingHorizontal: 28, justifyContent: 'space-between', overflow: 'hidden' },
  blob: { position: 'absolute', width: 380, height: 380, borderRadius: 190, opacity: 0.45 },
  heroInner: { marginTop: 24, maxWidth: 480, width: '100%', alignSelf: 'center' },
  heroIcon: { width: 76, height: 76, borderRadius: 18, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' },
  heroEyebrow: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '800', letterSpacing: 2, marginTop: 28 },
  heroTitle: { color: C.white, fontSize: 40, lineHeight: 44, fontFamily: F.display, letterSpacing: -1, marginTop: 10 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  featureText: { flex: 1, color: C.white, fontSize: 16, fontWeight: '700' },
  heroBottom: { alignItems: 'center', maxWidth: 480, width: '100%', alignSelf: 'center' },
  heroBtn: { width: '100%', minHeight: 56, borderRadius: R.pill, backgroundColor: C.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  appleBtn: { width: '100%', minHeight: 56, borderRadius: R.pill, backgroundColor: '#000', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  appleLogo: { color: '#fff', fontSize: 22, marginTop: -3 },
  appleText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  heroBtnText: { color: C.blueDeep, fontSize: 18, fontFamily: F.display },
  heroLink: { color: C.white, fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingBottom: 6, maxWidth: 600, width: '100%', alignSelf: 'center' },
  back: { width: 44, height: 36, justifyContent: 'center', transform: [{ scaleX: -1 }] },
  progress: { flex: 1, flexDirection: 'row', gap: 6 },
  seg: { flex: 1, height: 5, borderRadius: 3 },
  skip: { color: C.sub, fontSize: 15, fontWeight: '700' },
  scroll: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 30, maxWidth: 600, width: '100%', alignSelf: 'center' },
  q: { fontSize: 32, lineHeight: 37, fontFamily: F.display, color: C.ink, letterSpacing: -0.7 },
  qSub: { fontSize: 16, lineHeight: 23, color: C.sub, marginTop: 10 },
  label: { fontSize: 13, fontWeight: '800', color: C.sub, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 30, marginBottom: 12 },
  bigInput: { marginTop: 30, fontSize: 30, fontWeight: '800', color: C.ink, borderBottomWidth: 2, borderBottomColor: C.blue, paddingVertical: 10, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null) },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.card, borderRadius: 18, paddingHorizontal: 16, minHeight: 58, borderWidth: 2, borderColor: 'transparent' },
  choiceOn: { borderColor: C.blue, backgroundColor: C.bluePale },
  choiceIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.bluePale, alignItems: 'center', justifyContent: 'center' },
  choiceText: { fontSize: 17, fontWeight: '800', color: C.ink },
  choiceSub: { fontSize: 13, color: C.sub, marginTop: 2 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  radioOn: { backgroundColor: C.blue, borderColor: C.blue },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pill: { minWidth: 62, height: 48, paddingHorizontal: 16, borderRadius: 16, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  pillOn: { backgroundColor: C.blue },
  pillText: { fontSize: 17, fontWeight: '800', color: C.ink },
  privacy: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 24, backgroundColor: C.card, borderRadius: 16, padding: 14 },
  privacyText: { flex: 1, fontSize: 13, lineHeight: 19, color: C.sub },
  bellWrap: { width: 120, height: 120, borderRadius: 40, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 24, marginBottom: 16 },
  tag: { backgroundColor: C.card, borderRadius: R.pill, paddingHorizontal: 14, paddingVertical: 8 },
  tagText: { fontSize: 14, fontWeight: '800', color: C.ink },
  footer: { paddingHorizontal: 24, paddingTop: 10, maxWidth: 600, width: '100%', alignSelf: 'center' },
  cta: { minHeight: 56, borderRadius: R.pill, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: C.white, fontSize: 18, fontFamily: F.display },
  err: { color: '#C0303F', fontWeight: '700', fontSize: 14, marginTop: 14, textAlign: 'center' },
});
