import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, T } from '../src/theme';
import { useStore } from '../src/store';
import { ChallengeBanner } from '../src/rewards';

// All live challenges (opened from the trophy button when more than one is running).
export default function ChallengesRoute() {
  const insets = useSafeAreaInsets();
  const { content } = useStore();
  const live = content.challenges.filter((c) => c.active);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }}>
      <View style={st.col}>
        <Text style={st.title}>Challenges</Text>
        <Text style={[T.small, { fontSize: 15, marginTop: 6, marginBottom: 22 }]}>Sign up, keep your streak, win rewards.</Text>
        <View style={{ gap: 12 }}>
          {live.map((c) => <ChallengeBanner key={c.id} ch={c} />)}
          {live.length === 0 ? <Text style={T.body}>No challenges right now.</Text> : null}
        </View>
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  col: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20 },
  title: { fontSize: 32, fontWeight: '900', color: C.ink, letterSpacing: -0.6 },
});
