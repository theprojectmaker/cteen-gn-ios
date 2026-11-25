import React, { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, T } from './theme';
import { Icon } from './icons';
import { tap, upcoming, useStore, type Post } from './store';
import { pickPhotos, type Snap } from './photo';
import { publishPhotos } from './leaderTools';

// Instagram-style "New post" for leaders: photos first, a headline and a caption, Share.
// Every new post sends everyone a notification (the server writes it: "New announcement: ...").
const KINDS: { k: Post['kind']; l: string }[] = [
  { k: 'News', l: 'Announcement' },
  { k: 'Photos', l: 'Photos' },
  { k: 'Food', l: 'Food' },
  { k: 'Rewards', l: 'Rewards' },
];

export function Composer() {
  const { composerOpen, setComposerOpen, leader, content, saveContent, uploadPhoto } = useStore();
  const insets = useSafeAreaInsets();
  const [photos, setPhotos] = useState<Snap[]>([]);
  const [main, setMain] = useState(0);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [kind, setKind] = useState<Post['kind']>('News');
  const [eventId, setEventId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!leader) return null;
  const reset = () => { setPhotos([]); setMain(0); setTitle(''); setCaption(''); setKind('News'); setEventId(''); setErr(null); };
  const linkable = upcoming(content.events);
  const close = () => { if (!busy) { setComposerOpen(false); reset(); } };
  const add = async () => {
    setErr(null);
    const r = await pickPhotos(4 - photos.length);
    if (!r) return;
    if ('error' in r) return setErr(r.error);
    setPhotos((p) => [...p, ...r].slice(0, 4));
    if (kind === 'News' && !caption && !title) setKind('Photos');
  };
  const share = async () => {
    const head = title.trim() || caption.trim().split(/[.!?\n]/)[0].slice(0, 80);
    if (head.length < 2) return setErr('Write a headline or a caption.');
    setBusy(true); setErr(null);
    const urls = await publishPhotos(photos, uploadPhoto);
    if (typeof urls === 'string') { setBusy(false); return setErr(urls); }
    const p: Post = { id: 'p-' + Date.now().toString(36), kind, pinned: false, title: head, body: title.trim() ? caption.trim() : caption.trim().slice(head.length).replace(/^[.!?\s]+/, ''), eventId, challengeId: '', photos: urls, linkLabel: '', linkUrl: '', at: new Date().toISOString() };
    const e = await saveContent({ ...content, posts: [p, ...content.posts] });
    setBusy(false);
    if (e) return setErr(e);
    tap(true);
    setComposerOpen(false);
    reset();
  };
  const canShare = !busy && (title.trim().length >= 2 || caption.trim().length >= 2);
  return (
    <Modal visible={composerOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: C.card }}>
        <View style={st.bar}>
          <Pressable onPress={close} hitSlop={10} accessibilityRole="button"><Text style={st.cancel}>Cancel</Text></Pressable>
          <Text style={st.barTitle}>New post</Text>
          <Pressable onPress={share} disabled={!canShare} hitSlop={10} accessibilityRole="button"><Text style={[st.share, !canShare && { opacity: 0.35 }]}>{busy ? 'Sharing…' : 'Share'}</Text></Pressable>
        </View>
        <ScrollView automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}>
          {photos.length ? (
            <View>
              <Image source={{ uri: photos[Math.min(main, photos.length - 1)].uri }} style={st.preview} resizeMode="cover" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.thumbs}>
                {photos.map((p, i) => (
                  <Pressable key={p.uri + i} onPress={() => setMain(i)} style={[st.thumb, i === main && st.thumbOn]} accessibilityRole="button" accessibilityLabel={`Photo ${i + 1}`}>
                    <Image source={{ uri: p.uri }} style={StyleSheet.absoluteFill} />
                    <Pressable onPress={() => { setPhotos((x) => x.filter((_, j) => j !== i)); setMain(0); }} hitSlop={6} style={st.thumbX} accessibilityRole="button" accessibilityLabel="Remove photo">
                      <Icon name="x" size={10} color="#FFFFFF" stroke={3} />
                    </Pressable>
                  </Pressable>
                ))}
                {photos.length < 4 ? (
                  <Pressable onPress={add} style={[st.thumb, st.thumbAdd]} accessibilityRole="button" accessibilityLabel="Add more photos">
                    <Icon name="plus" size={22} color={C.blueDeep} stroke={2.4} />
                  </Pressable>
                ) : null}
              </ScrollView>
            </View>
          ) : (
            <Pressable onPress={add} style={({ pressed }) => [st.empty, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel="Add photos">
              <View style={st.emptyIcon}><Icon name="camera" size={28} color={C.blueDeep} stroke={2} /></View>
              <Text style={st.emptyTitle}>Add photos</Text>
              <Text style={T.small}>Optional. Up to 4.</Text>
            </Pressable>
          )}
          <View style={{ paddingHorizontal: 18 }}>
            <TextInput value={title} onChangeText={setTitle} placeholder="Headline" placeholderTextColor={C.faint} style={st.headline} maxLength={100} accessibilityLabel="Headline" />
            <TextInput value={caption} onChangeText={setCaption} placeholder="Write a caption…" placeholderTextColor={C.faint} style={st.caption} multiline maxLength={1500} accessibilityLabel="Caption" />
            <View style={st.kinds}>
              {KINDS.map((x) => (
                <Pressable key={x.k} onPress={() => setKind(x.k)} style={[st.kind, kind === x.k && st.kindOn]} accessibilityRole="button" accessibilityState={{ selected: kind === x.k }}>
                  <Text style={[st.kindText, kind === x.k && st.kindTextOn]}>{x.l}</Text>
                </Pressable>
              ))}
            </View>
            {linkable.length ? (
              <View style={{ marginTop: 18 }}>
                <Text style={st.linkLabel}>Tapping the post opens</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {[{ id: '', title: 'Nothing' }, ...linkable].map((e) => (
                    <Pressable key={e.id || 'none'} onPress={() => setEventId(e.id)} style={[st.kind, eventId === e.id && st.kindOn]} accessibilityRole="button" accessibilityState={{ selected: eventId === e.id }}>
                      <Text style={[st.kindText, eventId === e.id && st.kindTextOn]} numberOfLines={1}>{e.title}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                {eventId ? <Text style={[T.small, { marginTop: 8 }]}>A reminder for an event: teens tap the post (or the notification) and land on the event to RSVP.</Text> : null}
              </View>
            ) : null}
            <View style={st.note}>
              <Icon name="bell" size={15} color={C.blueDeep} stroke={2.2} />
              <Text style={st.noteText}>Everyone gets a notification with a short summary.</Text>
            </View>
            {err ? <Text style={st.err}>{err}</Text> : null}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line },
  barTitle: { fontSize: 17, fontWeight: '800', color: C.ink },
  linkLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: C.sub, marginBottom: 10 },
  cancel: { fontSize: 16, color: C.ink },
  share: { fontSize: 16, fontWeight: '800', color: C.blue },
  preview: { width: '100%', aspectRatio: 1, backgroundColor: C.line },
  thumbs: { gap: 8, paddingHorizontal: 18, paddingVertical: 12 },
  thumb: { width: 60, height: 60, borderRadius: 12, overflow: 'hidden', backgroundColor: C.line },
  thumbOn: { borderWidth: 2.5, borderColor: C.blue },
  thumbX: { position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  thumbAdd: { alignItems: 'center', justifyContent: 'center', backgroundColor: C.bluePale },
  empty: { margin: 18, aspectRatio: 1.6, borderRadius: 22, borderWidth: 1.5, borderColor: C.line, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: C.bg },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.bluePale, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: C.ink },
  headline: { fontSize: 20, fontFamily: F.display, color: C.ink, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  caption: { fontSize: 16, lineHeight: 23, color: C.ink, minHeight: 120, paddingTop: 12, textAlignVertical: 'top' },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  kind: { paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, justifyContent: 'center' },
  kindOn: { backgroundColor: C.inverse, borderColor: C.inverse },
  kindText: { fontSize: 14, fontWeight: '700', color: C.ink },
  kindTextOn: { color: C.onInverse },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, padding: 12, borderRadius: 14, backgroundColor: C.bluePale },
  noteText: { flex: 1, fontSize: 13, fontWeight: '600', color: C.ink },
  err: { color: '#C0303F', marginTop: 12, fontSize: 14, fontWeight: '700' },
});
