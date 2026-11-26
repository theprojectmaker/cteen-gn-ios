import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { C, R, SP, T, display, numeral } from './theme';
import { Icon } from './icons';
import { calendarUrl, challengeFits, countdown, dateLabel, open, repeatLabel, upcoming, useStore, type EventItem } from './store';
import { parseDay } from './when';
import { audienceLabel, Card, Chips, Empty, EventCard, SaveHeart } from './ui';
import { BrushTag, Hairline, Label, Photo, Slab, eventPicture, useAspect, whenTag } from './look';
import { NameGate } from './rewards';
import { InviteCards } from './invites';

// ───────────────────────── Events ─────────────────────────
const EVENT_FILTERS = ['All', 'Great Neck', 'Saved'] as const;

export function Events() {
  const { saved, content, fits, markEventsSeen, gender, leader, setAdminOpen, setAdminTask } = useStore();
  const notForMe = content.challenges.filter((c) => c.active && !challengeFits(c, gender));
  useFocusEffect(useCallback(() => { markEventsSeen(); }, [markEventsSeen]));
  const [f, setF] = useState<(typeof EVENT_FILTERS)[number]>('All');
  // Featured (priority) events first, then by date.
  const list = upcoming(content.events).filter(fits).filter((e) => (f === 'All' ? true : f === 'Saved' ? saved.includes(e.id) : f === 'Great Neck' ? e.scope === 'gn' : e.scope === 'intl')).sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0));
  return (
    <>
      <View style={st.head}>
        <Text style={[T.h1, { flexShrink: 1 }]}>Events</Text>
        {leader ? <Slab kind="orange" size="md" icon="plus" label="New event" onPress={() => { setAdminTask('event'); setAdminOpen(true); }} accessibilityLabel="New event: open the event form" /> : null}
      </View>
      <Text style={[T.small, { marginTop: 4, marginBottom: 14 }]}>{(() => { const all = upcoming(content.events).filter(fits); const gn = all.filter((e) => e.scope === 'gn').length; return all.length ? `${all.length} coming up${gn ? ` · ${gn} in Great Neck` : ''}` : "What's coming up in Great Neck and around CTeen"; })()}</Text>
      <InviteCards eventOnly />
      <Chips tabs options={EVENT_FILTERS} value={f} onChange={setF} />
      <View style={{ marginTop: 18 }}>
        {list.map((e, i) => (
          <View key={e.id}>
            {i > 0 ? <Hairline strong style={{ marginTop: 28, marginBottom: 28 }} /> : null}
            <EventCard e={e} />
          </View>
        ))}
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

// Event details, shown in a slide-up sheet (app/event/[id].tsx). One column on the 18 pt gutter:
// the picture whole, when it is, what it is, the facts, how to join, about, and the extras.
export function EventDetails({ e }: { e: EventItem }) {
  const when = (repeatLabel(e) || dateLabel(e)) + (e.time ? ` · ${e.time}` : '');
  const facts: { label: string; value: string }[] = [
    { label: 'When', value: when },
    ...(e.place ? [{ label: 'Where', value: e.place }] : []),
    ...(e.price ? [{ label: 'Price', value: e.price }] : []),
    ...(audienceLabel(e) ? [{ label: 'For', value: audienceLabel(e) }] : []),
    { label: e.repeat === 'weekly' ? 'Next' : 'Starts', value: e.repeat === 'weekly' ? `${dateLabel(e)} · ${countdown(e)}` : countdown(e) },
  ];
  return (
    <View style={st.page}>
      <EventPicture e={e} />
      <View style={st.tagRow}>
        <BrushTag label={whenTag(e)} style={st.tag} />
        <SaveHeart id={e.id} />
      </View>
      <Text style={st.title} accessibilityRole="header">{e.title}</Text>
      <Text style={st.scope}>{e.scope === 'gn' ? 'Great Neck' : 'International'}</Text>

      <View style={st.facts}>
        {facts.map((f, i) => (
          <View key={f.label} style={[st.fact, i < facts.length - 1 && st.rule]}>
            <Text style={st.factLabel}>{f.label}</Text>
            <Text style={st.factValue}>{f.value}</Text>
          </View>
        ))}
      </View>

      <View style={st.block}>{e.signup === 'app' ? <InAppSignup e={e} /> : <WebsiteSignup e={e} />}</View>

      {e.who ? <Para title="Who it's for" body={e.who} /> : null}
      {e.about ? <Para title="About" body={e.about} /> : null}

      <View style={st.block}>
        <Action icon="calendar" label="Add to Apple Calendar" onPress={() => open(calendarUrl(e))} />
        {e.place ? <Action icon="pin" label="Get directions" onPress={() => open('https://maps.apple.com/?q=' + encodeURIComponent(e.place!))} last={!(e.signup === 'app' && e.payUrl)} /> : null}
        {e.signup === 'app' && e.payUrl ? <TicketAction e={e} /> : null}
      </View>
    </View>
  );
}

// The picture, whole, on a flat panel: a poster at its own shape, a photograph full width, or (no picture) the date.
function EventPicture({ e }: { e: EventItem }) {
  const win = useWindowDimensions();
  const picture = eventPicture(e);
  const ratio = useAspect(picture?.source, 0.77);
  const col = Math.min(win.width, 600) - SP.gutter * 2;
  if (picture && picture.kind === 'photo') return <Photo source={picture.source} accessibilityLabel={e.title} />;
  if (picture) {
    const maxH = Math.min(440, Math.round(win.height * 0.52));
    const w = Math.min(col - 32, (maxH - 32) * ratio);
    const bare = w > col * 0.9;
    const pw = bare ? col : Math.round(w), ph = Math.round(pw / ratio);
    return (
      <View style={[st.panel, bare ? st.panelBare : { height: ph + 32 }]}>
        <Image source={picture.source} style={{ width: pw, height: ph }} resizeMode="contain" accessibilityLabel={e.title} />
      </View>
    );
  }
  const d = parseDay(e.start);
  return (
    <View style={[st.panel, st.dateBox]} accessible accessibilityLabel={dateLabel(e)}>
      <Label tone="blue" size={13}>{['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()]} · {['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][d.getMonth()]}</Label>
      <Text style={st.dateNum}>{d.getDate()}</Text>
    </View>
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
  const note = !e.showGoing
    ? (mine ? 'Rabbi Zevy has you on the list. We’ll remind you before it starts.' : 'Tap I’m in and Rabbi Zevy saves you a spot.')
    : mine ? `Rabbi Zevy has you on the list.${others > 0 ? ` You and ${others} other${others === 1 ? '' : 's'} are going.` : ''}`
    : declined ? 'Maybe next time.' : count > 0 ? `${count} from Great Neck ${count === 1 ? 'is' : 'are'} going so far.` : 'Be the first to RSVP.';
  return (
    <View>
      <View style={st.btnRow}>
        {mine ? (
          <Slab kind="outline" icon="tick" label="You're in" height={56} style={st.btnMain} accessibilityLabel={`You're in: signed up for ${e.title}`} />
        ) : (
          <Slab label={busy ? 'Saving…' : "I'm in"} height={56} disabled={busy} style={st.btnMain}
            onPress={() => { setDeclined(false); name ? run(true) : setAsk(true); }} accessibilityLabel={`I'm in: sign up for ${e.title}`} />
        )}
        <Slab kind="ghost" label="Can't go" height={56} disabled={busy} style={st.btnSide} accessibilityState={{ selected: declined && !mine }}
          onPress={() => { setDeclined(true); if (mine) run(false); }} accessibilityLabel={`Can't go to ${e.title}`} />
      </View>
      {names.length ? <Text style={st.names} numberOfLines={2}>{names.slice(0, 4).join(', ')}{names.length > 4 ? ` and ${names.length - 4} more` : ''}</Text> : null}
      <Text style={st.note}>{note}</Text>
      {err ? <Text style={st.err} accessibilityLiveRegion="polite">{err}</Text> : null}
    </View>
  );
}

// International events: registration happens on the CTeen website.
function WebsiteSignup({ e }: { e: EventItem }) {
  return (
    <View>
      {e.url ? <Slab label="Register on the CTeen website" icon="external" height={56} onPress={() => open(e.url!)} accessibilityLabel="Register on the CTeen website" /> : null}
      <Text style={st.note}>This is an international CTeen event. Registration happens on the CTeen website.</Text>
    </View>
  );
}

// A plain row with a chevron: calendar, directions, tickets.
function Action({ icon, label, onPress, last }: { icon: string; label: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.action, !last && st.rule, pressed && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel={label}>
      <Icon name={icon} size={20} color={C.blue} stroke={2.1} />
      <Text style={st.actionText}>{label}</Text>
      <Icon name="right" size={16} color={C.faint} stroke={2.4} />
    </Pressable>
  );
}

function TicketAction({ e }: { e: EventItem }) {
  const { going } = useStore();
  return <Action icon="ticket" label={going.includes(e.id) ? 'Next: get your ticket' : 'Ticket info'} onPress={() => open(e.payUrl!)} last />;
}

function Para({ title, body }: { title: string; body: string }) {
  return (
    <View style={st.block}>
      <Text style={st.paraHead}>{title}</Text>
      <Text style={st.paraBody}>{body}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  page: { paddingHorizontal: SP.gutter, paddingTop: 58, paddingBottom: 28 },
  panel: { width: '100%', borderRadius: R.photo, backgroundColor: C.raised, borderWidth: 1, borderColor: C.printEdge, alignItems: 'center', justifyContent: 'center' },
  panelBare: { backgroundColor: 'transparent', borderWidth: 0 },
  dateBox: { height: 160, alignItems: 'flex-start', justifyContent: 'center', padding: 18 },
  dateNum: { ...numeral(72), marginLeft: -2, paddingRight: 10 },
  tagRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28 },
  tag: { flexShrink: 1 },
  title: { ...T.h1, marginTop: 18 },
  scope: { fontSize: 15, lineHeight: 21, color: C.sub, marginTop: 8 },
  facts: { marginTop: 32 },
  fact: { flexDirection: 'row', alignItems: 'baseline', gap: 16, paddingVertical: 16 },
  rule: { borderBottomWidth: 1, borderBottomColor: C.line },
  factLabel: { width: 72, fontSize: 15, lineHeight: 21, color: C.sub },
  factValue: { flex: 1, fontSize: 17, lineHeight: 23, fontWeight: '600', color: C.ink },
  block: { marginTop: 36 },
  btnRow: { flexDirection: 'row', gap: 10 },
  btnMain: { flex: 1 },
  btnSide: { minWidth: 130 },
  names: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: C.ink, marginTop: 16 },
  note: { fontSize: 15, lineHeight: 21, color: C.sub, marginTop: 12 },
  err: { color: C.red, fontWeight: '700', fontSize: 14, marginTop: 10 },
  paraHead: { ...display(26), marginBottom: 10 },
  paraBody: { fontSize: 16, lineHeight: 24, color: C.ink },
  action: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 17, minHeight: 56 },
  actionText: { flex: 1, fontSize: 17, fontWeight: '600', color: C.ink },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  notApplicable: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.line, opacity: 0.7 },
  naIcon: { width: 42, height: 42, borderRadius: R.chip, borderWidth: 1, borderColor: C.lineStrong, alignItems: 'center', justifyContent: 'center' },
  naPill: { paddingHorizontal: 10, height: 26, borderRadius: R.chip, borderWidth: 1, borderColor: C.lineStrong, justifyContent: 'center' },
  naText: { fontSize: 12, fontWeight: '700', color: C.sub },
});
