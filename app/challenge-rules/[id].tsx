import React from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { C, F, HUES, T } from '../../src/theme';
import { Icon, challengeIcon } from '../../src/icons';
import { useStore } from '../../src/store';
import { challengeRules } from '../../src/challengeRules';

// A challenge's rules as a decorated card pop-up (drag down to close), like the event pop-ups.
export default function ChallengeRulesRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { content } = useStore();
  const insets = useSafeAreaInsets();
  const ch = content.challenges.find((c) => c.id === id);
  if (!ch) return <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}><Text style={T.body}>This challenge was removed.</Text></View>;
  const hue = HUES[ch.color] ?? HUES.blue;
  const rules = challengeRules(ch);
  const prize = ch.rewards[ch.rewards.length - 1];
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView automaticallyAdjustKeyboardInsets contentContainerStyle={{ paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        {/* decorated header: the leader's cover photo, or the challenge color with soft shapes */}
        <View style={[st.head, { backgroundColor: hue.solid }]}>
          {ch.image ? (
            <>
              <Image source={{ uri: ch.image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,20,32,0.45)' }]} />
            </>
          ) : (
            <Svg style={StyleSheet.absoluteFill} viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice">
              <Defs><LinearGradient id="hg" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={hue.solid} /><Stop offset="1" stopColor={hue.deep} /></LinearGradient></Defs>
              <Rect width="400" height="240" fill="url(#hg)" />
              <Circle cx="340" cy="30" r="110" fill="#FFFFFF" opacity={0.08} />
              <Circle cx="40" cy="230" r="90" fill="#FFFFFF" opacity={0.06} />
              <Circle cx="300" cy="200" r="34" fill="#FFFFFF" opacity={0.07} />
            </Svg>
          )}
          <View style={st.headIcon}><Icon name={challengeIcon(ch)} size={28} color={hue.solid} stroke={2} /></View>
          <Text style={st.headEyebrow}>How it works</Text>
          <Text style={st.headTitle}>{ch.title}</Text>
          {ch.about ? <Text style={st.headAbout} numberOfLines={3}>{ch.about}</Text> : null}
        </View>

        <View style={st.body}>
          <Text style={st.section}>The rules</Text>
          <View style={st.rules}>
            {rules.map((r, i) => (
              <View key={i} style={[st.rule, i > 0 && st.ruleLine]}>
                <View style={[st.num, { backgroundColor: hue.pale }]}><Text style={[st.numText, { color: hue.deep }]}>{i + 1}</Text></View>
                <Text style={st.ruleText}>{r}</Text>
              </View>
            ))}
          </View>

          {prize ? (
            <View style={st.prize}>
              <View style={st.prizeIcon}><Icon name="gift" size={22} color="#9A6A05" stroke={2.1} /></View>
              <View style={{ flex: 1 }}>
                <Text style={st.prizeEyebrow}>Finish all {prize.at}</Text>
                <Text style={st.prizeText}>{prize.prize}</Text>
              </View>
            </View>
          ) : null}
          <Text style={st.foot}>Questions? Ask Rabbi Zevy.</Text>
        </View>
      </ScrollView>
      <Pressable onPress={() => router.back()} style={st.close} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
        <Icon name="x" size={18} color="#FFFFFF" stroke={2.4} />
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  head: { minHeight: 250, paddingHorizontal: 22, paddingTop: Platform.OS === 'ios' ? 34 : 50, paddingBottom: 24, justifyContent: 'flex-end', overflow: 'hidden' },
  headIcon: { width: 54, height: 54, borderRadius: 17, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  headEyebrow: { fontSize: 12, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' },
  headTitle: { fontSize: 28, lineHeight: 32, fontFamily: F.display, color: '#FFFFFF', marginTop: 4, letterSpacing: -0.5 },
  headAbout: { fontSize: 15, lineHeight: 21, color: 'rgba(255,255,255,0.9)', marginTop: 8 },
  body: { padding: 20, width: '100%', maxWidth: 600, alignSelf: 'center' },
  section: { fontSize: 20, fontFamily: F.display, color: C.ink, marginBottom: 12 },
  rules: { borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, paddingHorizontal: 16 },
  rule: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 15 },
  ruleLine: { borderTopWidth: 1, borderTopColor: C.line },
  num: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  numText: { fontSize: 14, fontWeight: '900' },
  ruleText: { flex: 1, fontSize: 16, lineHeight: 22, color: C.ink, paddingTop: 4 },
  prize: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16, padding: 16, borderRadius: 22, backgroundColor: '#FFF6DC', borderWidth: 1, borderColor: '#F3D98A' },
  prizeIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  prizeEyebrow: { fontSize: 12, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase', color: '#9A6A05' },
  prizeText: { fontSize: 17, fontWeight: '800', color: '#3B2A05', marginTop: 2 },
  foot: { fontSize: 13, color: C.faint, textAlign: 'center', marginTop: 18 },
  close: { position: 'absolute', right: 14, top: 14, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
});
