import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { C, T } from '../src/theme';
import { Icon } from '../src/icons';
import { useStore, type Broadcast } from '../src/store';
import { timeAgo } from '../src/feed';
import { Label, Page, type Tone } from '../src/look';

// Inbox (Settings): everything the chapter sent to everyone, so nothing gets missed:
// notifications, live banners, pop-ups, new posts and events. New ones have a dot.
const KIND: Record<Broadcast['kind'], { icon: string; label: string; tone: Tone }> = {
  notification: { icon: 'bell', label: 'Notification', tone: 'blue' },
  banner: { icon: 'megaphone', label: 'Live banner', tone: 'red' },
  popup: { icon: 'star', label: 'Pop-up', tone: 'sub' },
  post: { icon: 'chat', label: 'Announcement', tone: 'sub' },
  event: { icon: 'calendar', label: 'New event', tone: 'orange' },
};

export default function InboxRoute() {
  const { loadBroadcasts, inboxSeen, markInboxSeen, openTarget } = useStore();
  const [items, setItems] = useState<Broadcast[] | null>(null);
  const [seenBefore, setSeenBefore] = useState(inboxSeen);
  const [refreshing, setRefreshing] = useState(false);
  const load = async () => { const r = await loadBroadcasts(); setItems(r ?? []); };
  useFocusEffect(useCallback(() => {
    setSeenBefore(inboxSeen);
    load().then(() => markInboxSeen());
  }, []));
  return (
    <Page refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={C.blue} />}>
      <Text style={T.h1}>Inbox</Text>
      <Text style={[T.small, { marginTop: 6, marginBottom: 14 }]}>Everything the chapter sent, so you never miss a thing.</Text>
      {items === null ? <Text style={T.small}>Loading…</Text> : items.length === 0 ? (
        <View style={st.empty}>
          <Text style={[T.h2, { color: C.sub }]}>Nothing yet</Text>
          <Text style={[T.small, { marginTop: 6 }]}>Notifications and banners from Rabbi Zevy will show up here.</Text>
        </View>
      ) : (
        <View>
          {items.map((b, i) => {
            const k = KIND[b.kind] ?? KIND.notification;
            const isNew = !seenBefore || b.at > seenBefore;
            return (
              <Pressable key={b.id} onPress={() => openTarget(b.target)} disabled={!b.target} style={({ pressed }) => [st.row, i > 0 && st.rule, pressed && { opacity: 0.6 }]} accessibilityRole={b.target ? 'button' : 'text'} accessibilityLabel={`${k.label}: ${b.title}`}>
                <View style={{ flex: 1 }}>
                  <View style={st.meta}>
                    {isNew ? <View style={st.dot} /> : null}
                    <Label tone={k.tone} size={11} style={{ flex: 1 }}>{k.label}</Label>
                    <Text style={st.ago}>{timeAgo(b.at)}</Text>
                  </View>
                  <Text style={[T.h3, { marginTop: 5 }]} numberOfLines={2}>{b.title}</Text>
                  {b.text ? <Text style={[T.small, { marginTop: 3 }]} numberOfLines={3}>{b.text}</Text> : null}
                </View>
                {b.target ? <Icon name="right" size={16} color={C.faint} stroke={2.4} /> : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </Page>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  rule: { borderTopWidth: 1, borderTopColor: C.line },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  ago: { fontSize: 12, color: C.faint, fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.orange },
  empty: { paddingTop: 40 },
});
