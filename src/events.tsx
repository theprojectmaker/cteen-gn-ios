import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C, R, SP, T } from './theme';
import { Icon } from './icons';
import { calendarUrl, challengeFits, countdown, dateLabel, open, repeatLabel, upcoming, useStore, type EventItem } from './store';
import { audienceLabel, Button, Card, Chips, Empty, EventCard } from './ui';
import { Label, Photo, PosterStage, eventPicture } from './look';
import { NameGate } from './rewards';
import { InviteCards } from './invites';

// ───────────────────────── Events ─────────────────────────
const EVENT_FILTERS = ['All', 'Great Neck', 'Saved'] as const;

export function Events() {
  const { saved, content, fits, markEventsSeen, gender } = useStore();
  const notForMe = content.challenges.filter((c) => c.active && !challengeFits(c, gender));
  useFocusEffect(useCallback(() => { markEventsSeen(); }, [markEventsSeen]));
  const [f, setF] = useState<(typeof EVENT_FILTERS)[number]>('All');
  // Featured (priority) events first, then by date.
  const list = upcoming(content.events).filter(fits).filter((e) => (f === 'All' ? true : f === 'Saved' ? saved.includes(e.id) : f === 'Great Neck' ? e.scope === 'gn' : e.scope === 'intl')).sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0));
  return (
    <>
      <Text style={T.h1}>Events</Text>
      <Text style={[T.small, { marginTop: 4, marginBottom: 14 }]}>{(() => { const all = upcoming(content.events).filter(fits); const gn = all.filter((e) => e.scope === 'gn').length; return all.length ? `${all.length} coming up${gn ? ` · ${gn} in Great Neck` : ''}` : "What's coming up in Great Neck and around CTeen"; })()}</Text>
      <InviteCards eventOnly />
      <Chips tabs options={EVENT_FILTERS} value={f} onChange={setF} />
      <View style={{ gap: 28, marginTop: 14 }}>
        {list.map((e) => <EventCard key={e.id} e={e} />)}
      </View>
      {f === 'All' && notForMe.length ? (
        <View style={{ marginTop: 30, gap: 12 }}>
          {notForMe.map((c) => (
            <View key={c.id} style={st.notApplicable} accessibilityLabel={`${c.title}. For boys, not applicable.`}>
              <View style={st.naIcon}><Icon name="tefillin" size={22} color={C.faint} stroke={2} /></View>
              <View style={{ flex: 1 }}>
                <Text style={[T.h3, { color: C.sub }]}>{c.title}</Text>
                <Text style={T.small}>For boys</Text>
              </View>
              <View style={st.naPill}><Text style={st.naText}>Not applicable</Text></View>
            </View>
          ))}
        </View>
      ) : null}
      {list.length === 0 ? (
        <Empty icon={f === 'Saved' ? 'heart' : 'calendar'} title={f === 'Saved' ? 'No saved events yet' : 'Nothing here right now'} body={f === 'Saved' ? 'Tap the heart on an event to keep it here.' : 'New events are on the way. Check the feed.'} />
      ) : null}
    </>
  );
}

// Event details, shown in a slide-up sheet (app/event/[id].tsx).
export function EventDetails({ e }: { e: EventItem }) {
  const picture = eventPicture(e);
  return (
    <>
      {/* the picture whole, with no text over it: a poster on its stage, a photograph edge to edge */}
      {picture ? (picture.kind === 'poster' ? <PosterStage source={picture.source} maxHeight={440} radius={0} accessibilityLabel={e.title} /> : <Photo source={picture.source} radius={0} accessibilityLabel={e.title} />) : <View style={{ height: 52 }} />}
      <View style={{ paddingHorizontal: SP.gutter, paddingTop: 18, paddingBottom: 28 }}>
        <Label tone="blue">{e.scope === 'gn' ? 'Great Neck' : 'International'}</Label>
        <Text style={[T.h1, { marginTop: 6, marginBottom: 16 }]}>{e.title}</Text>
        <Card style={{ padding: 0 }}>
          <Row icon="calendar" label="When" value={(repeatLabel(e) || dateLabel(e)) + (e.time ? ` · ${e.time}` : '')} first />
          {audienceLabel(e) ? <Row icon="users" label="For" value={audienceLabel(e)} /> : null}
          {e.place ? <Row icon="pin" label="Where" value={e.place} /> : null}
          {e.price ? <Row icon="ticket" label="Price" value={e.price} /> : null}
          <Row icon="clock" label={e.repeat === 'weekly' ? 'Next' : 'Starts'} value={e.repeat === 'weekly' ? `${dateLabel(e)} · ${countdown(e)}` : countdown(e)} />
        </Card>
        {e.who ? <Para title="Who it's for" body={e.who} /> : null}
        {e.about ? <Para title="About" body={e.about} /> : null}
        <View style={{ marginTop: 20 }}>
          {e.signup === 'app' ? <InAppSignup e={e} /> : <WebsiteSignup e={e} />}
        </View>
        <View style={{ marginTop: 10 }}>
          <Button kind="ghost" icon="calendar" label="Add to Apple Calendar" onPress={() => open(calendarUrl(e))} />
        </View>
        {e.place ? (
          <View style={{ marginTop: 10 }}>
            <Button kind="ghost" icon="pin" label="Get directions" onPress={() => open('https://maps.apple.com/?q=' + encodeURIComponent(e.place!))} />
          </View>
        ) : null}
      </View>
    </>
  );
}

// Great Neck events: RSVP right here in one tap (your name comes from your profile); the rabbi
// sees the list, everyone sees how many are going.
function InAppSignup({ e }: { e: EventItem }) {
  const { going, name, signup, goingCount, goingNames } = useStore();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);
  const mine = going.includes(e.id);
  const count = e.showGoing ? goingCount[e.id] ?? 0 : 0;
  const names = e.showGoing ? goingNames[e.id] ?? [] : [];
  const run = async (on: boolean) => {
    setBusy(true); setErr(null);
    setErr(await signup(e.id, on));
    setBusy(false);
  };
  useEffect(() => { setAsk(false); setErr(null); setDeclined(false); }, [e.id]);
  if (ask) return <Card><NameGate title="Who's going?" cta="I'm going" onDone={() => { setAsk(false); run(true); }} /></Card>;
  const others = Math.max(0, count - (mine ? 1 : 0));
  return (
    <View>
      <View style={st.rsvp}>
        <View style={st.rsvpHead}>
          <Text style={[T.h2, { flex: 1 }]}>{mine ? "You're going" : declined ? 'Maybe next time' : 'Are you going?'}</Text>
          {count > 0 ? (
            <View style={st.goingPill}>
              <Icon name="users" size={14} color={C.blueDeep} stroke={2.2} />
              <Text style={st.goingPillText}>{count} going</Text>
            </View>
          ) : null}
        </View>
        <View style={st.rsvpRow}>
          <Pressable
            onPress={() => { if (mine) return; setDeclined(false); name ? run(true) : setAsk(true); }}
            disabled={busy}
            style={({ pressed }) => [st.rsvpBtn, mine && st.rsvpYes, pressed && { transform: [{ scale: 0.97 }] }]}
            accessibilityRole="button" accessibilityState={{ selected: mine }}>
            <Icon name={mine ? 'tick' : 'check'} size={18} color={mine ? C.onBlue : C.ink} stroke={2.4} />
            <Text style={[st.rsvpText, mine && { color: C.onBlue }]}>{busy && !mine ? 'Saving…' : 'Going'}</Text>
          </Pressable>
          <Pressable
            onPress={() => { setDeclined(true); if (mine) run(false); }}
            disabled={busy}
            style={({ pressed }) => [st.rsvpBtn, declined && !mine && st.rsvpNo, pressed && { transform: [{ scale: 0.97 }] }]}
            accessibilityRole="button" accessibilityState={{ selected: declined && !mine }}>
            <Icon name="x" size={17} color={declined && !mine ? C.onInverse : C.ink} stroke={2.4} />
            <Text style={[st.rsvpText, declined && !mine && { color: C.onInverse }]}>Can't go</Text>
          </Pressable>
        </View>
        {names.length ? <Text style={st.goingNames} numberOfLines={2}>{names.slice(0, 4).join(', ')}{names.length > 4 ? ` and ${names.length - 4} more` : ''}</Text> : null}
        <Text style={st.rsvpNote}>
          {!e.showGoing ? (mine ? 'Rabbi Zevy has you on the list. We’ll remind you before it starts.' : 'Tap Going and Rabbi Zevy saves you a spot.') : mine ? `Rabbi Zevy has you on the list. We’ll remind you before it starts.${others > 0 ? ` You and ${others} other${others === 1 ? '' : 's'} are going.` : ''}` : count > 0 ? `${count} from Great Neck ${count === 1 ? 'is' : 'are'} going so far.` : 'Be the first to RSVP.'}
        </Text>
      </View>
      {err ? <Text style={st.err} accessibilityLiveRegion="polite">{err}</Text> : null}
      {e.payUrl ? (
        <View style={{ marginTop: 10 }}>
          <Button kind="ghost" icon="ticket" label={mine ? 'Next: get your ticket' : 'Ticket info'} onPress={() => open(e.payUrl!)} />
        </View>
      ) : null}
    </View>
  );
}

// International events: registration happens on the CTeen website.
function WebsiteSignup({ e }: { e: EventItem }) {
  return (
    <View>
      <View style={st.intlNote}>
        <Icon name="globe" size={20} color={C.sub} />
        <Text style={[T.small, { flex: 1, color: C.ink }]}>This is an international CTeen event. Registration happens on the CTeen website.</Text>
      </View>
      {e.url ? (
        <View style={{ marginTop: 10 }}>
          <Button label="Register on the CTeen website" icon="external" color={C.night} onPress={() => open(e.url!)} />
        </View>
      ) : null}
    </View>
  );
}

function Row({ icon, label, value, first }: { icon: string; label: string; value: string; first?: boolean }) {
  return (
    <View style={[st.row, !first && st.rule]}>
      <Icon name={icon} size={18} color={C.sub} />
      <Text style={[T.small, { fontSize: 14 }]}>{label}</Text>
      <Text style={[T.strong, { fontSize: 15, flex: 1, textAlign: 'right' }]}>{value}</Text>
    </View>
  );
}

function Para({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ marginTop: 20 }}>
      <Label>{title}</Label>
      <Text style={[T.body, { marginTop: 6 }]}>{body}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  notApplicable: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.line, opacity: 0.7 },
  naIcon: { width: 42, height: 42, borderRadius: R.chip, borderWidth: 1, borderColor: C.lineStrong, alignItems: 'center', justifyContent: 'center' },
  naPill: { paddingHorizontal: 10, height: 26, borderRadius: R.chip, borderWidth: 1, borderColor: C.lineStrong, justifyContent: 'center' },
  naText: { fontSize: 12, fontWeight: '700', color: C.sub },
  rsvp: { padding: 16, borderRadius: R.card, backgroundColor: C.card },
  rsvpHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  goingPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 28, borderRadius: R.chip, backgroundColor: C.bluePale },
  goingPillText: { fontSize: 13, fontWeight: '800', color: C.blueDeep },
  rsvpRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  rsvpBtn: { flex: 1, height: 50, borderRadius: R.btn, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: C.lineStrong },
  rsvpYes: { backgroundColor: C.blue, borderColor: C.blue },
  rsvpText: { fontSize: 16, fontWeight: '800', color: C.ink },
  rsvpNo: { backgroundColor: C.inverse, borderColor: C.inverse },
  goingNames: { fontSize: 14, fontWeight: '700', color: C.ink, marginTop: 12 },
  rsvpNote: { fontSize: 13, color: C.sub, marginTop: 12, lineHeight: 18 },
  err: { color: C.red, fontWeight: '700', fontSize: 13, marginTop: 8, textAlign: 'center' },
  intlNote: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: R.card, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 16 },
  rule: { borderTopWidth: 1, borderTopColor: C.line },
});
