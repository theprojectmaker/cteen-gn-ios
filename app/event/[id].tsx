import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, T } from '../../src/theme';
import { useStore, withNextDate } from '../../src/store';
import { EventDetails } from '../../src/screens';
import { Backdrop, CloseButton } from '../../src/look';

// Opens as Apple's slide-up sheet (see app/_layout.tsx): the system draws the grab pill on
// iPhone and you drag it down to close. The web preview draws its own pill and close button.
export default function EventRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { content } = useStore();
  const insets = useSafeAreaInsets();
  const raw = content.events.find((x) => x.id === id);
  const e = raw ? withNextDate(raw) : undefined;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Backdrop />
      <ScrollView automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive" contentContainerStyle={{ paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        <View style={st.col}>
          {e ? <EventDetails e={e} /> : <Text style={[T.body, { textAlign: 'center', marginTop: 60 }]}>This event isn't on the calendar anymore.</Text>}
        </View>
      </ScrollView>
      {Platform.OS === 'web' ? (
        <>
          <View style={st.webPill} pointerEvents="none" />
          <CloseButton onPress={() => router.back()} style={st.close} />
        </>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  col: { width: '100%', maxWidth: 600, alignSelf: 'center' },
  webPill: { position: 'absolute', top: 8, alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: C.track },
  close: { position: 'absolute', right: 14, top: 14 },
});
