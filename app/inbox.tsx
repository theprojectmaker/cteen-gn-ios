import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, T } from '../src/theme';
import { Icon } from '../src/icons';
import { useStore, type Broadcast } from '../src/store';
import { timeAgo } from '../src/feed';

// Inbox (Settings): everything the chapter sent to everyone, so nothing gets missed:
// notifications, live banners, pop-ups, new posts and events. New ones have a dot.
const KIND: Record<Broadcast['kind'], { icon: string; label: string; color: string; bg: string }> = {
  notification: { icon: 'bell', label: 'Notification', color: '#0C5E9E', bg: '#E7F5FC' },
  banner: { icon: 'megaphone', label: 'Live banner', color: '#C21F3A', bg: '#FDE7EA' },
  popup: { icon: 'star', label: 'Pop-up', color: '#4A32B8', bg: '#EFEBFF' },
  post: { icon: 'chat', label: 'Announcement', color: '#136B48', bg: '#E3F6EE' },
  event: { icon: 'calendar', label: 'New event', color: '#9A5A16', bg: '#FDF0E3' },
};

export default function InboxRoute() {
  const insets = useSafeAreaInsets();
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
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingTop: insets.top + 56, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={C.blue} />}>
      <View style={{ maxWidth: 600, width: '100%', alignSelf: 'center' }}>
        <Text style={st.title}>Inbox</Text>
        <Text style={[T.small, { marginBottom: 18 }]}>Everything the chapter sent, so you never miss a thing.</Text>
        {items === null ? <Text style={T.small}>Loading…</Text> : items.length === 0 ? (
          <View style={st.empty}>
            <Icon name="bell" size={30} color={C.faint} stroke={1.8} />
            <Text style={st.emptyText}>Nothing yet. Notifications and banners from Rabbi Zevy will show up here.</Text>
          </View>
        ) : (
          <View style={st.list}>
            {items.map((b, i) => {
              const k = KIND[b.kind] ?? KIND.notification;
              const isNew = !seenBefore || b.at > seenBefore;
              return (
                <Pressable key={b.id} onPress={() => openTarget(b.target)} disabled={!b.target} style={({ pressed }) => [st.row, i > 0 && st.rule, pressed && { backgroundColor: C.bg }]} accessibilityRole={b.target ? 'button' : 'text'} accessibilityLabel={`${k.label}: ${b.title}`}>
                  <View style={[st.icon, { backgroundColor: k.bg }]}><Icon name={k.icon} size={18} color={k.color} stroke={2.1} /></View>
                  <View style={{ flex: 1 }}>
                    <View style={st.meta}>
                      <Text style={[st.kind, { color: k.color }]}>{k.label}</Text>
                      <Text style={st.ago}>{timeAgo(b.at)}</Text>
                    </View>
                    <Text style={[st.rowTitle, isNew && { fontWeight: '900' }]} numberOfLines={2}>{b.title}</Text>
                    {b.text ? <Text style={st.rowText} numberOfLines={3}>{b.text}</Text> : null}
                  </View>
                  {isNew ? <View style={st.dot} /> : b.target ? <Icon name="right" size={16} color={C.faint} stroke={2.4} /> : null}
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  title: { fontSize: 30, fontFamily: F.display, color: C.ink, letterSpacing: -0.6 },
  list: { borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  rule: { borderTopWidth: 1, borderTopColor: C.line },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kind: { fontSize: 11, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase' },
  ago: { fontSize: 12, color: C.faint, fontWeight: '600' },
  rowTitle: { fontSize: 15, fontWeight: '700', color: C.ink, marginTop: 3 },
  rowText: { fontSize: 14, lineHeight: 19, color: C.sub, marginTop: 2 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.blue, marginTop: 6 },
  empty: { alignItems: 'center', gap: 10, padding: 30, borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  emptyText: { fontSize: 14, color: C.sub, textAlign: 'center' },
});
