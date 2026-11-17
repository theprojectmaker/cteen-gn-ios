import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, T } from '../../src/theme';
import { Icon } from '../../src/icons';
import { useStore } from '../../src/store';
import { PostCard, PostComments } from '../../src/feed';

// A Feed post opened full, in Apple's card pop-up (drag down to close), with its comments.
export default function PostRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { content } = useStore();
  const insets = useSafeAreaInsets();
  const post = content.posts.find((p) => p.id === id);
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={st.grab} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 22, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={st.col}>
          {post ? (
            <>
              <PostCard post={post} full />
              <PostComments postId={post.id} />
            </>
          ) : <Text style={[T.body, { textAlign: 'center', marginTop: 60 }]}>This post was removed.</Text>}
        </View>
      </ScrollView>
      <Pressable onPress={() => router.back()} style={st.close} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
        <Icon name="x" size={18} color={C.ink} stroke={2.4} />
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  col: { width: '100%', maxWidth: 600, alignSelf: 'center' },
  grab: { width: 40, height: 5, borderRadius: 3, backgroundColor: C.line, alignSelf: 'center', marginTop: 8, display: Platform.OS === 'ios' ? 'none' : 'flex' },
  close: { position: 'absolute', right: 14, top: 14, width: 36, height: 36, borderRadius: 18, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
});
