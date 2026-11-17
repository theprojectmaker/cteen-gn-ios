import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { C, F, T } from './theme';
import { Icon } from './icons';
import { CHAPTER, open, sortPosts, tap, useStore, type Post, type PostComment } from './store';
import { Button, Cover, Empty, EventMeta, s as u } from './ui';

// The Feed, Instagram style: one clean card per post with big photos, a heart and comments.
// Likes and comments are shared (server); your own heart shows instantly.

const ND = Platform.OS !== 'web';
export function timeAgo(iso: string) {
  const s = Math.max(1, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function Feed() {
  const { content, leader, setAdminOpen, markFeedSeen } = useStore();
  useEffect(() => { markFeedSeen(); }, []);
  const list = sortPosts(content.posts);
  return (
    <>
      <View style={st.feedHead}>
        <View style={{ flex: 1 }}>
          <Text style={T.h1}>Feed</Text>
          <Text style={[T.small, { marginTop: 4 }]}>From Rabbi Zevy and the {CHAPTER.name} leaders</Text>
        </View>
        {leader ? (
          <Pressable onPress={() => setAdminOpen(true)} style={({ pressed }) => [st.newBtn, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel="New post">
            <Icon name="plus" size={20} color={C.white} stroke={2.6} />
          </Pressable>
        ) : null}
      </View>
      <View style={{ gap: 16, marginTop: 18 }}>
        {list.map((p) => <PostCard key={p.id} post={p} />)}
      </View>
      {list.length === 0 ? <Empty icon="chat" title="Nothing here yet" body="Posts from the chapter show up here." /> : null}
    </>
  );
}

export function PostCard({ post, full, compact }: { post: Post; full?: boolean; compact?: boolean }) {
  const { liked, likePost, postMeta, openEvent, openChallenge, content, leader, saveContent } = useStore();
  const on = liked.includes(post.id);
  const meta = postMeta[post.id] ?? { likes: 0, comments: 0 };
  const pop = useRef(new Animated.Value(1)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const lastTap = useRef(0);
  const [w, setW] = useState(0);
  const [page, setPage] = useState(0);
  const [pinBusy, setPinBusy] = useState(false);
  const ev = post.eventId ? content.events.find((e) => e.id === post.eventId) : undefined;
  const ch = post.challengeId ? content.challenges.find((c) => c.id === post.challengeId) : undefined;

  const like = (force?: boolean) => {
    if (on && force) { heartBurst(); return; } // double-tap never un-likes
    if (!on) {
      tap();
      pop.setValue(0.55);
      Animated.spring(pop, { toValue: 1, friction: 3, tension: 220, useNativeDriver: ND }).start();
    }
    likePost(post.id);
    if (force) heartBurst();
  };
  const heartBurst = () => {
    burst.setValue(0);
    Animated.sequence([
      Animated.spring(burst, { toValue: 1, friction: 4, tension: 160, useNativeDriver: ND }),
      Animated.timing(burst, { toValue: 2, duration: 260, delay: 250, useNativeDriver: ND }),
    ]).start();
  };
  const onMediaPress = (fallback: () => void) => {
    const now = Date.now();
    if (now - lastTap.current < 300) { lastTap.current = 0; like(true); return; }
    lastTap.current = now;
    setTimeout(() => { if (lastTap.current === now) fallback(); }, 300);
  };
  const togglePin = async () => {
    setPinBusy(true);
    await saveContent({ ...content, posts: content.posts.map((p) => (p.id === post.id ? { ...p, pinned: !p.pinned } : p)) });
    setPinBusy(false);
  };
  const openPost = () => { if (!full) router.push(`/post/${post.id}`); };

  const photos = post.photos?.length ? post.photos : null;
  const media = compact ? null : photos ? 'photos' : ev?.image ? 'event' : null;

  return (
    <View style={st.card}>
      {/* header */}
      <View style={st.head}>
        <View style={st.avatarRing}><Image source={require('../assets/logo.png')} style={st.avatar} resizeMode="contain" /></View>
        <View style={{ flex: 1 }}>
          <Text style={st.author} numberOfLines={1}>{CHAPTER.name} <Text style={st.ago}>· {timeAgo(post.at)}</Text></Text>
          <Text style={st.kind}>{post.kind}</Text>
        </View>
        {leader ? (
          <Pressable onPress={togglePin} disabled={pinBusy} hitSlop={8} style={({ pressed }) => [st.pinBtn, post.pinned && st.pinOn, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel={post.pinned ? 'Unpin post' : 'Pin post'}>
            <Icon name="pinned" size={13} color={post.pinned ? C.white : C.blueDeep} stroke={2.2} />
            <Text style={[st.pinText, post.pinned && { color: C.white }]}>{pinBusy ? '…' : post.pinned ? 'Pinned' : 'Pin'}</Text>
          </Pressable>
        ) : post.pinned ? (
          <View style={st.pinBtn}><Icon name="pinned" size={13} color={C.blueDeep} stroke={2.2} /><Text style={st.pinText}>Pinned</Text></View>
        ) : null}
      </View>

      {/* media */}
      {media ? (
        <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={st.media}>
          {media === 'photos' ? (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(e) => w && setPage(Math.round(e.nativeEvent.contentOffset.x / w))} scrollEventThrottle={16}>
              {photos!.map((uri) => (
                <Pressable key={uri} onPress={() => onMediaPress(openPost)} style={{ width: w || 1, height: '100%' }} accessibilityLabel="Photo. Double tap to like.">
                  <Image source={{ uri }} style={u.fill} resizeMode="cover" />
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <Pressable onPress={() => onMediaPress(() => openEvent(ev!.id))} style={u.fill} accessibilityRole="button" accessibilityLabel={`${ev!.title}. Double tap to like.`}>
              <Cover e={ev!} style={u.fill} iconSize={80} />
              <View style={st.mediaChip}>
                <Text style={st.mediaChipTitle} numberOfLines={1}>{ev!.title}</Text>
                <EventMeta e={ev!} />
              </View>
            </Pressable>
          )}
          <Animated.View pointerEvents="none" style={[st.bigHeart, {
            opacity: burst.interpolate({ inputRange: [0, 0.3, 1, 2], outputRange: [0, 1, 1, 0] }),
            transform: [{ scale: burst.interpolate({ inputRange: [0, 1, 2], outputRange: [0.3, 1, 1.15] }) }],
          }]}>
            <Icon name="heart" size={96} color="#FFFFFF" fill="#FFFFFF" />
          </Animated.View>
          {photos && photos.length > 1 ? (
            <View style={st.dots}>{photos.map((_, i) => <View key={i} style={[st.dot, i === page && st.dotOn]} />)}</View>
          ) : null}
        </View>
      ) : null}

      {/* actions */}
      <View style={st.actions}>
        <Pressable onPress={() => like()} hitSlop={8} style={st.action} accessibilityRole="button" accessibilityLabel={on ? 'Unlike' : 'Like'}>
          <Animated.View style={{ transform: [{ scale: pop }] }}>
            <Icon name="heart" size={25} color={on ? '#E8364F' : C.ink} fill={on ? '#E8364F' : 'none'} stroke={2} />
          </Animated.View>
          {meta.likes > 0 ? <Text style={st.actionCount}>{meta.likes}</Text> : null}
        </Pressable>
        <Pressable onPress={openPost} disabled={full} hitSlop={8} style={st.action} accessibilityRole="button" accessibilityLabel="Comments">
          <Icon name="chat" size={24} color={C.ink} stroke={2} />
          {meta.comments > 0 ? <Text style={st.actionCount}>{meta.comments}</Text> : null}
        </Pressable>
        <View style={{ flex: 1 }} />
        {post.linkUrl ? (
          <Pressable onPress={() => open(post.linkUrl!)} hitSlop={8} style={st.linkBtn} accessibilityRole="link">
            <Text style={st.linkText}>{post.linkLabel || 'Open link'}</Text>
            <Icon name="right" size={14} color={C.blue} stroke={2.6} />
          </Pressable>
        ) : null}
      </View>

      {/* text */}
      <Pressable onPress={openPost} disabled={full} style={{ paddingHorizontal: 16 }} accessibilityRole={full ? undefined : 'button'}>
        <Text style={[st.title, full && { fontSize: 22, lineHeight: 27 }]}>{post.title}</Text>
        {post.body ? <Text style={[st.body, full && { fontSize: 16, lineHeight: 24 }]} numberOfLines={full ? undefined : 3}>{post.body}</Text> : null}
        {!full && (post.body?.length ?? 0) > 140 ? <Text style={st.more}>more</Text> : null}
      </Pressable>

      {/* event without a photo / challenge: a small row to open it */}
      {ev && media !== 'event' ? (
        <Pressable onPress={() => openEvent(ev.id)} style={({ pressed }) => [st.attach, pressed && u.pressed]} accessibilityRole="button" accessibilityLabel={`Open ${ev.title}`}>
          <Cover e={ev} style={st.attachImg} iconSize={22} />
          <View style={{ flex: 1 }}><Text style={T.h3} numberOfLines={1}>{ev.title}</Text><EventMeta e={ev} /></View>
          <Icon name="right" size={18} color={C.faint} stroke={2.4} />
        </Pressable>
      ) : null}
      {ch ? (
        <Pressable onPress={() => openChallenge(ch.id)} style={({ pressed }) => [st.attach, pressed && u.pressed]} accessibilityRole="button" accessibilityLabel={`Open ${ch.title}`}>
          <Cover e={ch} style={st.attachImg} iconSize={22} />
          <View style={{ flex: 1 }}><Text style={T.h3} numberOfLines={1}>{ch.title}</Text><Text style={st.kind}>{ch.active ? 'Live now' : 'Ended'}</Text></View>
          <Icon name="right" size={18} color={C.faint} stroke={2.4} />
        </Pressable>
      ) : null}

      {!full ? (
        <Pressable onPress={openPost} hitSlop={4} style={{ paddingHorizontal: 16, paddingTop: 10 }} accessibilityRole="button">
          <Text style={st.viewComments}>{meta.comments > 0 ? `View ${meta.comments === 1 ? '1 comment' : `all ${meta.comments} comments`}` : 'Add a comment…'}</Text>
        </Pressable>
      ) : null}
      <View style={{ height: 16 }} />
    </View>
  );
}

// Comments under a post (on the post's own page).
export function PostComments({ postId }: { postId: string }) {
  const { loadComments, addComment, deletePostComment, leader, name } = useStore();
  const [list, setList] = useState<PostComment[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { loadComments(postId).then((c) => setList(c ?? [])); }, [postId]);
  const send = async () => {
    const v = text.trim();
    if (!v) return;
    setBusy(true); setErr(null);
    const r = await addComment(postId, v);
    setBusy(false);
    if ('error' in r) return setErr(r.error);
    tap();
    setList(r);
    setText('');
  };
  return (
    <View style={st.comments}>
      <Text style={st.commentsTitle}>Comments</Text>
      {list === null ? <Text style={T.small}>Loading…</Text> : list.length === 0 ? <Text style={T.small}>No comments yet. Say something nice.</Text> : (
        list.map((c) => (
          <View key={c.at + c.name} style={st.comment}>
            <View style={st.cAvatar}><Text style={st.cInitial}>{c.name[0]?.toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={st.cText}><Text style={st.cName}>{c.name}  </Text>{c.text}</Text>
              <Text style={st.cAgo}>{timeAgo(c.at)}</Text>
            </View>
            {leader ? (
              <Pressable onPress={async () => { if (await deletePostComment(postId, c.at)) setList((l) => (l || []).filter((x) => x.at !== c.at)); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Delete comment">
                <Icon name="x" size={15} color={C.faint} stroke={2.4} />
              </Pressable>
            ) : null}
          </View>
        ))
      )}
      <View style={st.inputRow}>
        <View style={st.cAvatar}><Text style={st.cInitial}>{name[0]?.toUpperCase() || '?'}</Text></View>
        <TextInput value={text} onChangeText={setText} placeholder="Add a comment…" placeholderTextColor={C.faint} style={st.input} maxLength={300} onSubmitEditing={send} returnKeyType="send" accessibilityLabel="Add a comment" />
        <Pressable onPress={send} disabled={busy || !text.trim()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Post comment">
          <Text style={[st.postText, (!text.trim() || busy) && { opacity: 0.4 }]}>{busy ? '…' : 'Post'}</Text>
        </Pressable>
      </View>
      {err ? <Text style={[T.small, { color: '#C0303F', marginTop: 6 }]}>{err}</Text> : null}
    </View>
  );
}

const st = StyleSheet.create({
  feedHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  newBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: C.card, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: C.line },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  avatarRing: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: C.blue, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card },
  avatar: { width: 18, height: 32 },
  author: { fontSize: 15, fontWeight: '800', color: C.ink },
  ago: { fontSize: 14, fontWeight: '500', color: C.faint },
  kind: { fontSize: 12, color: C.sub, marginTop: 1 },
  pinBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 28, borderRadius: 14, backgroundColor: C.bluePale },
  pinOn: { backgroundColor: C.blue },
  pinText: { fontSize: 12, fontWeight: '800', color: C.blueDeep },
  media: { width: '100%', aspectRatio: 4 / 5, maxHeight: 520, backgroundColor: C.line, overflow: 'hidden' },
  mediaShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%', backgroundColor: 'rgba(8,20,32,0.35)' },
  mediaChip: { position: 'absolute', left: 12, right: 12, bottom: 12, padding: 12, borderRadius: 16, backgroundColor: C.card },
  mediaChipTitle: { fontSize: 16, fontWeight: '800', color: C.ink },
  bigHeart: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  dots: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotOn: { backgroundColor: '#FFFFFF' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionCount: { fontSize: 15, fontWeight: '800', color: C.ink, fontVariant: ['tabular-nums'] },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  linkText: { fontSize: 14, fontWeight: '800', color: C.blue },
  title: { fontSize: 17, lineHeight: 22, fontFamily: F.display, color: C.ink, marginTop: 2 },
  body: { fontSize: 15, lineHeight: 21, color: C.ink, marginTop: 4 },
  more: { fontSize: 14, color: C.faint, fontWeight: '700', marginTop: 2 },
  attach: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 14, marginTop: 12, padding: 10, borderRadius: 16, backgroundColor: C.bg },
  attachImg: { width: 48, height: 48, borderRadius: 12 },
  viewComments: { fontSize: 14, color: C.faint, fontWeight: '600' },
  comments: { marginTop: 18, padding: 16, borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  commentsTitle: { fontSize: 17, fontFamily: F.display, color: C.ink, marginBottom: 12 },
  comment: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
  cAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.bluePale, alignItems: 'center', justifyContent: 'center' },
  cInitial: { fontSize: 13, fontWeight: '900', color: C.blueDeep },
  cName: { fontWeight: '800', color: C.ink },
  cText: { fontSize: 14, lineHeight: 20, color: C.ink },
  cAgo: { fontSize: 12, color: C.faint, marginTop: 2 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line },
  input: { flex: 1, minHeight: 40, fontSize: 15, color: C.ink, paddingVertical: 8 },
  postText: { fontSize: 15, fontWeight: '800', color: C.blue },
});
