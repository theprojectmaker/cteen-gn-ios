import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, T } from '../../src/theme';
import { useStore } from '../../src/store';
import { ChallengePage } from '../../src/rewards';

export default function ChallengeRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { content } = useStore();
  const insets = useSafeAreaInsets();
  const ch = content.challenges.find((c) => c.id === id);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingTop: insets.top + 56, paddingBottom: insets.bottom + 40 }}>
      <View style={st.col}>
        {ch ? <ChallengePage ch={ch} /> : <Text style={[T.body, { textAlign: 'center', marginTop: 40 }]}>This challenge isn't available anymore.</Text>}
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({ col: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20 } });
