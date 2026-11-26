import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { C, F, R, T, display } from './theme';
import { Icon } from './icons';
import { CHAPTER, countdown, daysUntil, open, sortPosts, tap, upcoming, useStore, type Post, type PostComment } from './store';
import { Hairline, Label } from './look';
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
  const { content, leader, setComposerOpen, markFeedSeen, fits, openEvent, seenPosts, seenInit, unreadFeed } = useStore();
  // The posts you had not seen when you opened the Feed: shown in a NEW group for this visit only.
  // Opening the Feed marks them seen (the tab badge clears at once); leaving it puts them back in
  // their normal places. (The old code marked posts seen only when the screen was first built,
  // from a stale copy of the count, so posts that arrived afterwards stayed "unread" for good.)
  const [fresh, setFresh] = useState<string[]>([]);
  const focused = useRef(false);
  const latest = useRef({ content, seenPosts, seenInit, markFeedSeen });
  latest.current = { content, seenPosts, seenInit, markFeedSeen };
  const capture = useCallback(() => {
    const l = latest.current;
    if (!l.seenInit) return;
    const ids = l.content.posts.filter((p) => !l.seenPosts.includes(p.id)).map((p) => p.id);
    if (!ids.length) return;
    setFresh((f) => [...new Set([...f, ...ids])]);
    l.markFeedSeen();
  }, []);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    capture();
    return () => { focused.current = false; setFresh([]); };
  }, [capture]));
  // a post that arrives while the Feed is open joins the NEW group too
  useEffect(() => { if (focused.current && unreadFeed > 0) capture(); }, [unreadFeed, seenInit]);
  const sorted = sortPosts(content.posts);
  const pinned = sorted.filter((p) => p.pinned);
  const news = sorted.filter((p) => !p.pinned && fresh.includes(p.id)).sort((a, b) => b.at.localeCompare(a.at));
  const list = sorted.filter((p) => !p.pinned && !fresh.includes(p.id));
  // Events in the next 3 days are pinned to the top of the Feed on their own (weekly ones too).
  const soon = upcoming(content.events).filter(fits).filter((e) => daysUntil(e.start) <= 3).slice(0, 4);
  return (
    <>
      <View style={st.feedHead}>
        <View style={{ flex: 1 }}>
          <Text style={T.h1}>Feed</Text>
          <Text style={[T.small, { marginTop: 4 }]}>From Rabbi Zevy and the {CHAPTER.name} leaders</Text>
        </View>
        {leader ? (
          <Pressable onPress={() => setComposerOpen(true)} style={({ pressed }) => [st.newBtn, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel="New post">
            <Icon name="plus" size={20} color={C.onOrange} stroke={2.6} />
          </Pressable>
        ) : null}
      </View>
      {soon.length ? (
        <View style={st.soonBox}>
          <Text style={st.soonHead}>Happening soon</Text>
          {soon.map((e, i) => {
            const today = daysUntil(e.start) <= 0;
            return (
              <Pressable key={e.id} onPress={() => openEvent(e.id)} style={({ pressed }) => [st.soonRow, i > 0 && st.soonRule, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel={e.title}>
                <View style={[st.soonDot, today && { backgroundColor: C.orange }]} />
                <View style={{ flex: 1 }}>
                  <Text style={st.soonTitle} numberOfLines={1}>{e.title}</Text>
                  <Text style={st.soonSub} numberOfLines={1}>{countdown(e)}{e.time ? ` · ${e.time}` : ''}{e.place ? ` · ${e.place}` : ''}</Text>
                </View>
                <Text style={[st.soonGo, today && { color: C.orangeText }]}>{e.signup === 'app' ? 'RSVP' : 'Details'}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <View style={{ gap: 16, marginTop: 18 }}>
        {pinned.map((p) => <PostCard key={p.id} post={p} isNew={fresh.includes(p.id)} />)}
        {news.length ? (
          <>
            <View style={st.newHead}><Label tone="orange" size={13}>{news.length === 1 ? 'New post' : `${news.length} new posts`}</Label></View>
            {news.map((p) => <PostCard key={p.id} post={p} isNew />)}
            <Hairline strong style={st.newEnd} />
          </>
        ) : null}
        {list.map((p) => <PostCard key={p.id} post={p} />)}
      </View>
      {sorted.length === 0 ? <Empty icon="chat" title="Nothing here yet" body="Posts from the chapter show up here." /> : null}
    </>
  );
}

export function PostCard({ post, full, compact, isNew }: { post: Post; full?: boolean; compact?: boolean; isNew?: boolean }) {
  const { liked, likePost, postMeta, openEvent, openChallenge, content, leader, saveContent, goingCount } = useStore();
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
  const removePost = () => {
    const run = async () => { setPinBusy(true); await saveContent({ ...content, posts: content.posts.filter((p) => p.id !== post.id) }); setPinBusy(false); };
    const g = globalThis as { confirm?: (m: string) => boolean };
    if (Platform.OS === 'web') { if (g.confirm ? g.confirm(`Delete "${post.title}" for everyone?`) : false) run(); return; }
    Alert.alert('Delete this post?', `"${post.title}" will be removed for everyone.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: run }]);
  };
  const openPost = () => { if (!full) router.push(`/post/${post.id}`); };

  const photos = post.photos?.length ? post.photos : null;
  const media = compact ? null : photos ? 'photos' : ev?.image ? 'event' : null;

  return (
    <View style={[st.card, isNew && st.cardNew]}>
      {/* header */}
      <View style={st.head}>
        <View style={st.avatarRing}><Image source={require('../assets/mark.png')} style={st.avatar} resizeMode="contain" /></View>
        <View style={{ flex: 1 }}>
          <Text style={st.author} numberOfLines={1}>{CHAPTER.name} <Text style={st.ago}>· {timeAgo(post.at)}</Text></Text>
          <View style={st.kindRow}>{isNew ? <Text style={st.newTag}>NEW</Text> : null}<Text style={st.kind}>{post.kind}</Text></View>
        </View>
        {leader && !full && !compact ? (
          <Pressable onPress={removePost} disabled={pinBusy} hitSlop={8} style={({ pressed }) => [st.delBtn, pressed && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel={`Delete post: ${post.title}`}>
            <Text style={st.delText}>Delete</Text>
          </Pressable>
        ) : null}
        {leader ? (
          <Pressable onPress={togglePin} disabled={pinBusy} hitSlop={8} style={({ pressed }) => [st.pinBtn, post.pinned && st.pinOn, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel={post.pinned ? 'Unpin post' : 'Pin post'}>
            <Icon name="pinned" size={13} color={post.pinned ? C.onBlue : C.blueDeep} stroke={2.2} />
            <Text style={[st.pinText, post.pinned && { color: C.onBlue }]}>{pinBusy ? '…' : post.pinned ? 'Pinned' : 'Pin'}</Text>
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
                {ev!.signup === 'app' && (goingCount[ev!.id] ?? 0) > 0 ? <Text style={st.mediaGoing}>{goingCount[ev!.id]} going</Text> : null}
              </View>
            </Pressable>
          )}
          <Animated.View pointerEvents="none" style={[st.bigHeart, {
            opacity: burst.interpolate({ inputRange: [0, 0.3, 1, 2], outputRange: [0, 1, 1, 0] }),
            transform: [{ scale: burst.interpolate({ inputRange: [0, 1, 2], outputRange: [0.3, 1, 1.15] }) }],
          }]}>
            <Icon name="heart" size={96} color={C.white} fill={C.white} />
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
            <Icon name="heart" size={25} color={on ? C.orange : C.ink} fill={on ? C.orange : 'none'} stroke={2} />
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
        <Text style={full ? st.titleFull : st.title}>{post.title}</Text>
        {post.body ? <Text style={[st.body, full && { fontSize: 16, lineHeight: 24 }]} numberOfLines={full ? undefined : 3}>{post.body}</Text> : null}
        {!full && (post.body?.length ?? 0) > 140 ? <Text style={st.more}>more</Text> : null}
      </Pressable>

      {/* event without a photo / challenge: a small row to open it */}
      {ev && media !== 'event' ? (
        <Pressable onPress={() => openEvent(ev.id)} style={({ pressed }) => [st.attach, pressed && u.pressed]} accessibilityRole="button" accessibilityLabel={`Open ${ev.title}`}>
          <Cover e={ev} style={st.attachImg} iconSize={22} />
          <View style={{ flex: 1 }}><Text style={T.h3} numberOfLines={1}>{ev.title}</Text><EventMeta e={ev} />{ev.signup === 'app' && (goingCount[ev.id] ?? 0) > 0 ? <Text style={[T.small, { color: C.sub, marginTop: 2 }]}>{goingCount[ev.id]} going</Text> : null}</View>
          <Icon name="right" size={18} color={C.faint} stroke={2.4} />
        </Pressable>
      ) : null}
      {ch ? (
        <Pressable onPress={() => openChallenge(ch.id)} style={({ pressed }) => [st.attach, pressed && u.pressed]} accessibilityRole="button" accessibilityLabel={`Open ${ch.title}`}>
          <Cover e={ch} style={st.attachImg} iconSize={22} />
          <View style={{ flex: 1 }}><Text style={T.h3} numberOfLines={2}>{ch.title}</Text><Text style={st.kind}>{ch.active ? 'Live now' : 'Ended'}</Text></View>
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

// Comments under a post (on the post's own page): the initial, the comment, a box to reply.

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
      <View style={st.commentsHead}>
        <Text style={T.h2}>Comments</Text>
        {list && list.length ? <Text style={st.commentsCount}>{list.length}</Text> : null}
      </View>
      {list === null ? <Text style={[T.small, { paddingVertical: 8 }]}>Loading…</Text> : list.length === 0 ? (
        <View style={st.noComments}>
          <Icon name="chat" size={26} color={C.faint} stroke={1.8} />
          <Text style={st.noCommentsText}>No comments yet. Be the first.</Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {list.map((c) => (
            <View key={c.at + c.name} style={st.comment}>
              <View style={st.cAvatar}><Text style={st.cInitial}>{c.name[0]?.toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <View style={st.bubble}>
                  <Text style={st.cName}>{c.name}</Text>
                  <Text style={st.cText}>{c.text}</Text>
                </View>
                <View style={st.cMeta}>
                  <Text style={st.cAgo}>{timeAgo(c.at)}</Text>
                  {leader ? (
                    <Pressable onPress={async () => { if (await deletePostComment(postId, c.at)) setList((l) => (l || []).filter((x) => x.at !== c.at)); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Delete comment">
                      <Text style={st.cDelete}>Delete</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
      <View style={st.inputRow}>
        <View style={st.cAvatar}><Text style={st.cInitial}>{name[0]?.toUpperCase() || '?'}</Text></View>
        <View style={st.inputPill}>
          <TextInput value={text} onChangeText={setText} placeholder="Add a comment…" placeholderTextColor={C.faint} style={st.input} maxLength={300} onSubmitEditing={send} returnKeyType="send" multiline accessibilityLabel="Add a comment" />
          <Pressable onPress={send} disabled={busy || !text.trim()} hitSlop={6} style={[st.sendBtn, (!text.trim() || busy) && { opacity: 0.35 }]} accessibilityRole="button" accessibilityLabel="Post comment">
            <Icon name="send" size={16} color={C.onBlue} stroke={2.4} />
          </Pressable>
        </View>
      </View>
      {err ? <Text style={[T.small, { color: C.red, marginTop: 8 }]}>{err}</Text> : null}
    </View>
  );
}

const st = StyleSheet.create({
  feedHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  newBtn: { width: 44, height: 44, borderRadius: R.btnSm, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: C.card, borderRadius: R.card, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  avatarRing: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: C.blue, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card },
  avatar: { width: 22, height: 28 },
  author: { fontSize: 15, fontWeight: '800', color: C.ink },
  ago: { fontSize: 14, fontWeight: '500', color: C.faint },
  kind: { fontSize: 12, color: C.sub },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  newTag: { fontFamily: F.bold, fontSize: 11, lineHeight: 14, letterSpacing: 1.8, color: C.onOrange, backgroundColor: C.orange, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, overflow: 'hidden' },
  cardNew: { borderWidth: 1.5, borderColor: C.orange },
  newHead: { marginTop: 4 },
  newEnd: { marginTop: 12, marginBottom: 12 },
  delBtn: { minHeight: 28, justifyContent: 'center', paddingHorizontal: 4 },
  delText: { fontSize: 13, fontWeight: '700', color: C.red },
  pinBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 28, borderRadius: R.chip, backgroundColor: C.bluePale },
  pinOn: { backgroundColor: C.blue },
  pinText: { fontSize: 12, fontWeight: '800', color: C.blueDeep },
  media: { width: '100%', aspectRatio: 4 / 5, maxHeight: 520, backgroundColor: C.raised, overflow: 'hidden' },
  mediaChip: { position: 'absolute', left: 12, right: 12, bottom: 12, padding: 12, borderRadius: R.card, backgroundColor: C.card },
  mediaGoing: { color: C.sub, fontSize: 12, fontWeight: '700', marginTop: 3 },
  soonBox: { marginTop: 16, borderRadius: R.card, backgroundColor: C.card, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  soonHead: { ...T.eyebrow, marginBottom: 4 },
  soonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  soonRule: { borderTopWidth: 1, borderTopColor: C.line },
  soonDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.blue },
  soonTitle: { ...T.h3, fontSize: 18 },
  soonSub: { fontSize: 13, color: C.sub, marginTop: 2 },
  soonGo: { ...T.eyebrow, color: C.blue },
  mediaChipTitle: { ...T.h3 },
  bigHeart: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  dots: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotOn: { backgroundColor: C.white },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionCount: { fontSize: 15, fontWeight: '800', color: C.ink, fontVariant: ['tabular-nums'] },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  linkText: { fontSize: 14, fontWeight: '800', color: C.blue },
  title: { ...display(22), marginTop: 4 },
  titleFull: { ...display(28), marginTop: 4 },
  body: { fontSize: 15, lineHeight: 21, color: C.ink, marginTop: 4 },
  more: { fontSize: 14, color: C.faint, fontWeight: '700', marginTop: 2 },
  attach: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 14, marginTop: 12, padding: 10, borderRadius: R.card, backgroundColor: C.raised },
  attachImg: { width: 48, height: 48, borderRadius: R.print },
  viewComments: { fontSize: 14, color: C.faint, fontWeight: '600' },
  comments: { marginTop: 18, padding: 16, borderRadius: R.card, backgroundColor: C.card },
  commentsHead: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 14 },
  commentsCount: { ...T.eyebrow, fontSize: 13 },
  noComments: { alignItems: 'center', gap: 8, paddingVertical: 18 },
  noCommentsText: { fontSize: 14, color: C.sub, fontWeight: '600' },
  comment: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: C.avatar },
  cInitial: { fontSize: 14, fontWeight: '700', color: C.white },
  bubble: { alignSelf: 'flex-start', maxWidth: '100%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: R.card, borderTopLeftRadius: 3, backgroundColor: C.raised },
  cName: { fontSize: 13, fontWeight: '800', color: C.ink, marginBottom: 2 },
  cText: { fontSize: 15, lineHeight: 21, color: C.ink },
  cMeta: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4, marginLeft: 12 },
  cAgo: { fontSize: 12, color: C.faint, fontWeight: '600' },
  cDelete: { fontSize: 12, color: C.red, fontWeight: '700' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line },
  inputPill: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingLeft: 14, paddingRight: 5, paddingVertical: 5, borderRadius: R.input, backgroundColor: C.raised, borderWidth: 1, borderColor: C.lineStrong },
  input: { flex: 1, minHeight: 32, maxHeight: 110, fontSize: 15, color: C.ink, paddingTop: 7, paddingBottom: 7 },
  sendBtn: { width: 34, height: 34, borderRadius: R.chip, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
});
