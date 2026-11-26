import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, SP, T, display, numeral } from '../../src/theme';
import { useStore } from '../../src/store';
import { challengeRules } from '../../src/challengeRules';
import { Backdrop, Band, CloseButton, Label, Photo } from '../../src/look';

// A challenge's rules as a card pop-up (drag down to close), like the event pop-ups:
// the leader's cover photo when there is one, the name, the numbered rules, the prize.
export default function ChallengeRulesRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { content } = useStore();
  const insets = useSafeAreaInsets();
  const ch = content.challenges.find((c) => c.id === id);
  if (!ch) return <View style={[st.root, { alignItems: 'center', justifyContent: 'center' }]}><Backdrop /><Text style={T.body}>This challenge was removed.</Text></View>;
  const rules = challengeRules(ch);
  const prize = ch.rewards[ch.rewards.length - 1];
  return (
    <View style={st.root}>
      <Backdrop />
      <ScrollView automaticallyAdjustKeyboardInsets contentContainerStyle={{ paddingTop: 58, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        <View style={st.col}>
          {ch.image ? <Photo source={ch.image} style={{ marginBottom: 18 }} accessibilityLabel={ch.title} /> : null}
          <Label tone="blue">How it works</Label>
          <Text style={[T.h1, { marginTop: 6 }]}>{ch.title}</Text>
          {ch.about ? <Text style={[T.body, st.about]} numberOfLines={3}>{ch.about}</Text> : null}

          <Text style={[T.h2, { marginTop: SP.section }]}>The rules</Text>
          <View style={{ marginTop: 4 }}>
            {rules.map((r, i) => (
              <View key={i} style={[st.rule, i > 0 && st.ruleLine]}>
                <Text style={st.num}>{i + 1}</Text>
                <Text style={st.ruleText}>{r}</Text>
              </View>
            ))}
          </View>

          {prize ? (
            <Band style={{ marginTop: 18 }}>
              <Label tone="orange">Finish all {prize.at}, win</Label>
              <Text style={st.prize}>{prize.prize}</Text>
            </Band>
          ) : null}
          <Text style={st.foot}>Questions? Ask Rabbi Zevy.</Text>
        </View>
      </ScrollView>
      <CloseButton onPress={() => router.back()} style={st.close} />
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  col: { width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: SP.gutter },
  about: { color: C.sub, marginTop: 10 },
  rule: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 14 },
  ruleLine: { borderTopWidth: 1, borderTopColor: C.line },
  num: { ...numeral(26, C.blue), width: 32, textAlign: 'center', paddingRight: 4 },
  ruleText: { flex: 1, fontSize: 16, lineHeight: 22, color: C.ink, paddingTop: 2 },
  prize: { ...display(24), marginTop: 5 },
  foot: { fontSize: 13, color: C.faint, marginTop: 20 },
  close: { position: 'absolute', right: 14, top: 14 },
});
