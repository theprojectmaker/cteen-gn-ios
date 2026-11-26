import React from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { T } from '../../src/theme';
import { useStore } from '../../src/store';
import { ChallengePage } from '../../src/rewards';
import { Page } from '../../src/look';

export default function ChallengeRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { content } = useStore();
  const ch = content.challenges.find((c) => c.id === id);
  return (
    <Page>
      {ch ? <ChallengePage ch={ch} /> : <Text style={[T.body, { textAlign: 'center', marginTop: 40 }]}>This challenge isn't available anymore.</Text>}
    </Page>
  );
}
