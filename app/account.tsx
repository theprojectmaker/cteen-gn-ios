import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../src/theme';
import { AccountPage } from '../src/account';

export default function AccountRoute() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive" style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingTop: insets.top + 56, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
      <View style={st.col}>
        <AccountPage />
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({ col: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20 } });
