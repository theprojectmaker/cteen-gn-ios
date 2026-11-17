import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { C, F } from './theme';
import { dateLabel, useStore, type Invite } from './store';
import { scheduleInviteReminders } from './push';

// Personal invitations from the rabbi: a card on Home (and Events) until you answer. Accept keeps it
// with More info; Decline hides it. Reminders twice a day until you answer (if the rabbi turned that on).

export const firstName = (name: string) => name.trim().split(' ')[0] || 'friend';
export const personal = (text: string, name: string) => text.replace(/\{name\}/gi, firstName(name));

// Invitations for me: live, for my group, not expired, not declined. Answered ones last.
export function useMyInvites(eventOnly?: boolean) {
  const { content, gender, invites: answers } = useStore();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  return (content.invites || [])
    .filter((v) => v.on && (!v.until || v.until >= today))
    .filter((v) => v.audience === 'all' || (v.audience === 'boys' && gender !== 'girl') || (v.audience === 'girls' && gender === 'girl'))
    .filter((v) => (answers || {})[v.id] !== 'no')
    .filter((v) => !eventOnly || !!v.eventId)
    .sort((a, b) => Number(!!(answers || {})[a.id]) - Number(!!(answers || {})[b.id]));
}

export function InviteCards({ eventOnly }: { eventOnly?: boolean }) {
  const list = useMyInvites(eventOnly);
  if (!list.length) return null;
  return <View style={{ gap: 10, marginBottom: 18 }}>{list.map((v) => <InviteCard key={v.id} v={v} />)}</View>;
}

function InviteCard({ v }: { v: Invite }) {
  const { name, invites: answers, content } = useStore();
  const ev = v.eventId ? content.events.find((e) => e.id === v.eventId) : undefined;
  const yes = (answers || {})[v.id] === 'yes';
  return (
    <Pressable onPress={() => router.push(`/invite/${v.id}`)} style={({ pressed }) => [st.card, yes && st.cardYes, pressed && { opacity: 0.92 }]} accessibilityRole="button" accessibilityLabel={`Invitation: ${v.title}`}>
      <View style={{ flex: 1 }}>
        <Text style={[st.kicker, yes && { color: C.green }]}>{yes ? "You're going" : 'Invitation'}</Text>
        <Text style={st.title} numberOfLines={2}>{yes ? v.title : `${firstName(name)}, you're invited`}</Text>
        <Text style={st.sub} numberOfLines={1}>{yes ? (ev ? `${dateLabel(ev)}${ev.time ? ' · ' + ev.time : ''}` : 'Tap for the details') : `${v.title}${ev ? ' · ' + dateLabel(ev) : ''}`}</Text>
      </View>
      <Text style={[st.cta, yes && { color: C.green }]}>{yes ? 'More info' : 'Open'}</Text>
    </Pressable>
  );
}

// Twice a day (10 AM and 6 PM) until you answer, by name. Renders nothing.
export function InviteReminderSync() {
  const { push, name } = useStore();
  const list = useMyInvites();
  const { invites: answers } = useStore();
  const pending = list.filter((v) => v.remind && !(answers || {})[v.id]);
  const key = pending.map((v) => v.id + v.until).join('|') + name;
  useEffect(() => {
    if (push !== 'on') return;
    const first = firstName(name);
    const times: { id: string; at: number; title: string; body: string; target: string }[] = [];
    const now = new Date();
    for (const v of pending.slice(0, 3)) {
      for (let d = 0; d < 7; d++) {
        for (const hour of [10, 18]) {
          const t = new Date(now); t.setDate(now.getDate() + d); t.setHours(hour, 0, 0, 0);
          const ymd = t.toISOString().slice(0, 10);
          if (v.until && ymd > v.until) continue;
          times.push({ id: `inv-${v.id}-${d}-${hour}`, at: t.getTime(), title: `${first}, are you coming?`, body: `Rabbi Zevy invited you to ${v.title}. Tap to answer.`, target: v.id });
        }
      }
    }
    scheduleInviteReminders(times);
  }, [key, push]);
  return null;
}

const st = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, backgroundColor: C.card, borderLeftWidth: 4, borderLeftColor: C.orange },
  cardYes: { borderLeftColor: C.green },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: C.orange },
  title: { fontSize: 18, fontFamily: F.display, color: C.ink, marginTop: 3, letterSpacing: -0.2 },
  sub: { fontSize: 13, color: C.sub, marginTop: 2 },
  cta: { fontSize: 14, fontWeight: '800', color: C.orange },
});
