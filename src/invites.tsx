import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { C, T } from './theme';
import { dateLabel, useStore, type Invite } from './store';
import { scheduleInviteReminders } from './push';
import { Band, Label, Slab, prettyTime } from './look';

// Personal invitations from the rabbi: a band on Home (and Events) until you answer. YES keeps it
// there with More info; NO hides it. Reminders twice a day until you answer (if the rabbi turned that on).

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

// One band per invitation waiting for you. Renders nothing when there are none.
// skipEventId: leave out invitations to that event (on Home's event day the event already has the
// top of the page and its own I'M IN; the hero shows a small "You're invited" line instead).
export function InviteCards({ eventOnly, skipEventId, style }: { eventOnly?: boolean; skipEventId?: string; style?: StyleProp<ViewStyle> }) {
  const list = useMyInvites(eventOnly).filter((v) => !skipEventId || v.eventId !== skipEventId);
  if (!list.length) return null;
  // more than one: the bands stack, sharing the hairline between them
  return <View style={[st.list, style]}>{list.map((v, i) => <InviteBand key={v.id} v={v} joined={i > 0} />)}</View>;
}

// A band: YOU'RE INVITED, what to, the rabbi's line, and YES / NO right there (the same answer the
// invitation page records). Tap the words to open the invitation itself.
function InviteBand({ v, joined }: { v: Invite; joined?: boolean }) {
  const { name, invites: answers, content, respondInvite } = useStore();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ev = v.eventId ? content.events.find((e) => e.id === v.eventId) : undefined;
  const yes = (answers || {})[v.id] === 'yes';
  const when = ev ? `${dateLabel(ev)}${ev.time ? ' · ' + prettyTime(ev.time) : ''}` : '';
  const line = yes ? when || 'Tap for the details' : v.message ? personal(v.message, name) : when;
  const answer = async (a: 'yes' | 'no') => {
    setBusy(true); setErr(null);
    const e = await respondInvite(v.id, a);
    setBusy(false);
    if (e) setErr(e);
  };
  return (
    <Band style={joined && st.joined}>
      <View style={st.row}>
        <Pressable onPress={() => router.push(`/invite/${v.id}`)} style={({ pressed }) => [st.words, pressed && st.pressed]} accessibilityRole="button" accessibilityLabel={`Invitation: ${v.title}`}>
          <Label tone="blue">{yes ? "You're going" : "You're invited"}</Label>
          <Text style={[T.h3, st.title]} numberOfLines={2}>{v.title}</Text>
          {line ? <Text style={[T.small, st.line]} numberOfLines={2}>{line}</Text> : null}
        </Pressable>
        {yes ? (
          <Label tone="blue" onPress={() => router.push(`/invite/${v.id}`)} accessibilityLabel={`More info: ${v.title}`}>More info</Label>
        ) : (
          <View style={st.chips}>
            <Slab size="chip" kind="paper" label="Yes" disabled={busy} onPress={() => answer('yes')} accessibilityLabel={`Yes, I'm in: ${v.title}`} />
            <Slab size="chip" kind="ghost" label="No" disabled={busy} onPress={() => answer('no')} accessibilityLabel={`No, not this time: ${v.title}`} />
          </View>
        )}
      </View>
      {err ? <Text style={st.err} accessibilityLiveRegion="polite">{err}</Text> : null}
    </Band>
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
  list: { marginBottom: 18 },
  joined: { marginTop: -1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  words: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.6 },
  title: { marginTop: 5 },
  line: { marginTop: 3 },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  err: { fontSize: 13, fontWeight: '700', color: C.red, marginTop: 8 },
});
