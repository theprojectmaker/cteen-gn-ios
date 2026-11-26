import React from 'react';
import { Text, View } from 'react-native';
import { T } from '../src/theme';
import { useStore } from '../src/store';
import { ChallengeBanner } from '../src/rewards';
import { Page } from '../src/look';

// All live challenges (opened from the header chip when more than one is running).
export default function ChallengesRoute() {
  const { content } = useStore();
  const live = content.challenges.filter((c) => c.active);
  return (
    <Page top={60}>
      <Text style={T.h1}>Challenges</Text>
      <Text style={[T.small, { fontSize: 15, marginTop: 6, marginBottom: 22 }]}>Sign up, keep your streak, win rewards.</Text>
      <View style={{ gap: 12 }}>
        {live.map((c) => <ChallengeBanner key={c.id} ch={c} />)}
        {live.length === 0 ? <Text style={T.body}>No challenges right now.</Text> : null}
      </View>
    </Page>
  );
}
