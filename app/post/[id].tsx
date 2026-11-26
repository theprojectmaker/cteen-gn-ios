import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, SP, T } from '../../src/theme';
import { useStore } from '../../src/store';
import { PostCard, PostComments } from '../../src/feed';
import { Backdrop, CloseButton } from '../../src/look';

// A Feed post opened full, in Apple's card pop-up (drag down to close), with its comments.
export default function PostRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { content } = useStore();
  const insets = useSafeAreaInsets();
  const post = content.posts.find((p) => p.id === id);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Backdrop />
      <View style={st.grab} />
      <ScrollView automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive" contentContainerStyle={{ paddingHorizontal: SP.gutter, paddingTop: 44, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={st.col}>
          {post ? (
            <>
              <PostCard post={post} full />
              <PostComments postId={post.id} />
            </>
          ) : <Text style={[T.body, { textAlign: 'center', marginTop: 60 }]}>This post was removed.</Text>}
        </View>
      </ScrollView>
      <CloseButton onPress={() => router.back()} style={st.close} />
    </View>
  );
}

const st = StyleSheet.create({
  col: { width: '100%', maxWidth: 600, alignSelf: 'center' },
  grab: { width: 40, height: 5, borderRadius: 3, backgroundColor: C.track, alignSelf: 'center', marginTop: 8, display: Platform.OS === 'ios' ? 'none' : 'flex' },
  close: { position: 'absolute', right: 14, top: 14 },
});
