import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C, F, T } from './theme';
import { Icon } from './icons';
import { useStore, type AiEvent, type EventItem, type Popup } from './store';
import { Button, Chips, Field, Toggle, s as u } from './ui';
import { PhotoPicker, publishPhotos } from './leaderTools';
import type { Snap } from './photo';

// Leader tools for posters, events and the AI planner. Big plain fields, smart defaults, one button.

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const days = () => [...Array(21)].map((_, i) => {
  const d = new Date(); d.setDate(d.getDate() + i);
  return { v: iso(d), l: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) };
});
const TIMES = ['3:00 PM', '5:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM'];

function Switch({ title, sub, value, onChange }: { title: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={st.switch}>
      <View style={{ flex: 1 }}>
        <Text style={st.switchTitle}>{title}</Text>
        {sub ? <Text style={T.small}>{sub}</Text> : null}
      </View>
      <Toggle value={value} onChange={onChange} label={title} />
    </View>
  );
}

// ── Poster: shows after the opening animation, can send a notification with the poster ──
export function PosterForm({ onDone }: { onDone: (msg: string) => void }) {
  const { content, saveContent, uploadPhoto, sendPush } = useStore();
  const [poster, setPoster] = useState<Snap[]>([]);
  const [title, setTitle] = useState('');
  const [line, setLine] = useState('');
  const [more, setMore] = useState('');
  const [link, setLink] = useState('');
  const [onOpen, setOnOpen] = useState(true);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const opts = [{ v: '', l: 'Nothing' }, ...content.events.filter((e) => e.end >= iso(new Date())).map((e) => ({ v: 'event:' + e.id, l: e.title })), ...content.challenges.filter((c) => c.active).map((c) => ({ v: 'challenge:' + c.id, l: c.title }))];
  const post = async () => {
    if (!poster.length && title.trim().length < 2) return setErr('Add a poster or a headline.');
    setBusy(true); setErr(null);
    const urls = await publishPhotos(poster, uploadPhoto);
    if (typeof urls === 'string') { setBusy(false); return setErr(urls); }
    const [type, id] = link.split(':');
    const target = type ? { type: type as 'event' | 'challenge', id } : null;
    const popup: Popup = { on: onOpen, id: 'p' + Date.now().toString(36), title: title.trim(), body: line.trim(), more: more.trim(), button: '', target, image: urls[0] || '' };
    const e = await saveContent({ ...content, popup });
    if (e) { setBusy(false); return setErr(e); }
    let note = onOpen ? 'Poster is up. Everyone sees it right after the opening animation.' : 'Poster saved.';
    if (notify) note += ' ' + (await sendPush(title.trim() || 'New from CTeen Great Neck', line.trim() || more.trim().slice(0, 120) || 'Open the app to see it.', target, urls[0]));
    setBusy(false);
    onDone(note.trim());
  };
  return (
    <View>
      <Text style={st.h}>Poster</Text>
      <Text style={st.sub}>Upload a poster. It pops up right after the opening animation, and you can send everyone a notification with it.</Text>
      <PhotoPicker photos={poster} onChange={(p) => setPoster(p.slice(-1))} />
      <Field label="Headline" value={title} onChange={setTitle} placeholder="Like: Chanukah at the Islanders" />
      <Field label="One line under it (optional)" value={line} onChange={setLine} placeholder="Like: Sign-ups close Sunday" />
      <Field label="More info (optional)" value={more} onChange={setMore} multiline placeholder="Times, place, what to bring" />
      <Text style={[u.fieldLabel, { marginTop: 14 }]}>The button opens</Text>
      <Chips wrap options={opts.map((o) => o.l)} value={opts.find((o) => o.v === link)?.l ?? 'Nothing'} onChange={(l) => setLink(opts.find((o) => o.l === l)?.v ?? '')} />
      <Switch title="Show after the opening animation" sub="Every time someone opens the app, until you turn it off" value={onOpen} onChange={setOnOpen} />
      <Switch title="Send a notification too" sub="With the poster, so more people check it out" value={notify} onChange={setNotify} />
      <View style={{ marginTop: 20 }}><Button label={busy ? 'Posting…' : 'Post the poster'} disabled={busy} onPress={post} /></View>
      {err ? <Text style={st.err}>{err}</Text> : null}
    </View>
  );
}

// ── Event: quick picks for day and time, poster, who it's for, privacy ──
export function EventForm({ onDone, initial }: { onDone: (msg: string) => void; initial?: Partial<AiEvent> }) {
  const { content, saveContent, uploadPhoto } = useStore();
  const dayOpts = days();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [day, setDay] = useState(initial?.date && initial.date >= iso(new Date()) ? initial.date : dayOpts[0].v);
  const [time, setTime] = useState(initial?.time ?? '');
  const [place, setPlace] = useState(initial?.place || 'Chabad of Great Neck');
  const [about, setAbout] = useState(initial?.about ?? '');
  const [price, setPrice] = useState(initial?.price ?? '');
  const [who, setWho] = useState<'Everyone' | 'Boys' | 'Girls'>('Everyone');
  const [rsvp, setRsvp] = useState(true);
  const [showGoing, setShowGoing] = useState(false);
  const [alsoPost, setAlsoPost] = useState(!!initial?.post);
  const [poster, setPoster] = useState<Snap[]>([]);
  const [cover, setCover] = useState<Snap[]>([]);
  const [repeat, setRepeat] = useState<'Once' | 'Every week'>('Once');
  const [fullPoster, setFullPoster] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const extraDay = !dayOpts.some((d) => d.v === day);
  const save = async () => {
    if (title.trim().length < 2) return setErr('Give the event a name.');
    setBusy(true); setErr(null);
    const urls = await publishPhotos(poster, uploadPhoto);
    if (typeof urls === 'string') { setBusy(false); return setErr(urls); }
    const coverUrls = await publishPhotos(cover, uploadPhoto);
    if (typeof coverUrls === 'string') { setBusy(false); return setErr(coverUrls); }
    const ev: EventItem = {
      id: 'e-' + Date.now().toString(36), title: title.trim(), icon: 'star', color: 'blue', scope: 'gn', start: day, end: day,
      time: time.trim(), place: place.trim(), price: price.trim(), who: initial?.who ?? '', about: about.trim(),
      signup: rsvp ? 'app' : 'link', url: '', payUrl: '', gender: who === 'Boys' ? 'boys' : who === 'Girls' ? 'girls' : 'all', minAge: null, maxAge: null,
      cover: coverUrls[0] || '', poster: urls[0] || '', showGoing,
      repeat: repeat === 'Every week' ? 'weekly' : 'none', repeatUntil: '', fullPoster,
    };
    const posts = alsoPost ? [{ id: 'p-' + Date.now().toString(36), kind: 'Events' as const, pinned: false, title: initial?.post?.title || title.trim(), body: initial?.post?.body || about.trim(), eventId: ev.id, challengeId: '', photos: urls, linkLabel: '', linkUrl: '', at: new Date().toISOString() }, ...content.posts] : content.posts;
    const e = await saveContent({ ...content, events: [...content.events, ev], posts });
    setBusy(false);
    if (e) return setErr(e);
    onDone(`${ev.title} is up. Everyone got a "New event: join now" notification.`);
  };
  return (
    <View>
      <Text style={st.h}>{initial ? 'Check the AI’s event' : 'New event'}</Text>
      <Field label="Event name" value={title} onChange={setTitle} placeholder="Like: Pizza and Torah night" />
      <Text style={[u.fieldLabel, { marginTop: 14 }]}>Day</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {extraDay ? <View style={[u.chip, u.chipOn]}><Text style={[u.chipText, u.chipTextOn]}>{new Date(day + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</Text></View> : null}
        {dayOpts.map((d) => (
          <Pressable key={d.v} onPress={() => setDay(d.v)} style={[u.chip, day === d.v && u.chipOn]} accessibilityRole="button" accessibilityState={{ selected: day === d.v }}>
            <Text style={[u.chipText, day === d.v && u.chipTextOn]}>{d.l}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={[u.fieldLabel, { marginTop: 14 }]}>Repeats</Text>
      <Chips options={['Once', 'Every week'] as const} value={repeat} onChange={setRepeat} />
      {repeat === 'Every week' ? <Text style={[T.small, { marginTop: 6 }]}>Happens every {new Date(day + 'T12:00:00').toLocaleDateString([], { weekday: 'long' })}. Shows in "This week" on Home and on the Calendar.</Text> : null}
      <Text style={[u.fieldLabel, { marginTop: 14 }]}>Time</Text>
      <View style={u.chipsFlow}>
        {TIMES.map((x) => (
          <Pressable key={x} onPress={() => setTime(x)} style={[u.chip, time === x && u.chipOn]} accessibilityRole="button" accessibilityState={{ selected: time === x }}>
            <Text style={[u.chipText, time === x && u.chipTextOn]}>{x}</Text>
          </Pressable>
        ))}
      </View>
      <Field label="Or type a time" value={TIMES.includes(time) ? '' : time} onChange={setTime} placeholder="Like: 7:15 PM" />
      <Field label="Where" value={place} onChange={setPlace} />
      <Text style={[u.fieldLabel, { marginTop: 14 }]}>Who it's for</Text>
      <Chips options={['Everyone', 'Boys', 'Girls'] as const} value={who} onChange={setWho} />
      <Field label="Details" value={about} onChange={setAbout} multiline placeholder="What's happening, what to bring" />
      <Field label="Price (optional)" value={price} onChange={setPrice} placeholder="Like: Free, or $20" />
      <Text style={[u.fieldLabel, { marginTop: 14 }]}>Cover photo (shows on Home and the Events page)</Text>
      <PhotoPicker photos={cover} onChange={(p) => setCover(p.slice(-1))} />
      {cover.length ? <Switch title="This cover is a full poster" sub="Show the whole poster, fit (not cropped), with no title or date over it." value={fullPoster} onChange={setFullPoster} /> : null}
      <Text style={[u.fieldLabel, { marginTop: 14 }]}>Poster (flyer for the pop-up, optional)</Text>
      <PhotoPicker photos={poster} onChange={(p) => setPoster(p.slice(-1))} />
      <Switch title="RSVP in the app" sub="Teens tap Going, you see the list" value={rsvp} onChange={setRsvp} />
      <Switch title="Show who's going" sub="Off: teens only see their own RSVP. On: they see first names and how many." value={showGoing} onChange={setShowGoing} />
      <Switch title="Also post it to the Feed" value={alsoPost} onChange={setAlsoPost} />
      <View style={{ marginTop: 20 }}><Button label={busy ? 'Saving…' : 'Create the event'} disabled={busy} onPress={save} /></View>
      {err ? <Text style={st.err}>{err}</Text> : null}
    </View>
  );
}

// ── AI planner: an idea + what you know, keep it as is or let the AI improve it ──
export function AiPlanner({ onDone }: { onDone: (msg: string) => void }) {
  const { aiEvent } = useStore();
  const [prompt, setPrompt] = useState('');
  const [info, setInfo] = useState('');
  const [keep, setKeep] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<AiEvent | null>(null);
  const plan = async () => {
    setBusy(true); setErr(null);
    const r = await aiEvent(prompt, info, keep);
    setBusy(false);
    if ('error' in r) return setErr(r.error);
    setDraft(r);
  };
  if (draft) {
    return (
      <View>
        <Pressable onPress={() => setDraft(null)} hitSlop={8} style={{ marginBottom: 10 }} accessibilityRole="button"><Text style={st.back}>Change the idea</Text></Pressable>
        <EventForm initial={draft} onDone={onDone} />
      </View>
    );
  }
  return (
    <View>
      <View style={st.aiHead}>
        <View style={st.aiIcon}><Icon name="star" size={20} color="#FFFFFF" stroke={2.2} /></View>
        <View style={{ flex: 1 }}>
          <Text style={st.h}>AI event planner</Text>
          <Text style={T.small}>Say the idea, add what you know. The AI sets up the event for you to check.</Text>
        </View>
      </View>
      <Field label="What's the idea?" value={prompt} onChange={setPrompt} multiline placeholder="Like: a Chanukah party with latkes and a menorah lighting for the teens" />
      <Field label="What you already know (optional)" value={info} onChange={setInfo} multiline placeholder="Like: Sunday Dec 14, 6 PM, at the Chabad house, $10" />
      <Text style={[u.fieldLabel, { marginTop: 14 }]}>How should the AI handle your details?</Text>
      <View style={st.seg}>
        {[{ v: true, l: 'Keep my details' }, { v: false, l: 'Make it better' }].map((o) => (
          <Pressable key={o.l} onPress={() => setKeep(o.v)} style={[st.segBtn, keep === o.v && st.segOn]} accessibilityRole="button" accessibilityState={{ selected: keep === o.v }}>
            <Text style={[st.segText, keep === o.v && { color: C.onInverse }]}>{o.l}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={[T.small, { marginTop: 6 }]}>{keep ? 'Uses your details as you wrote them, just tidied up.' : 'Keeps your facts, writes a catchier name and description.'}</Text>
      <View style={{ marginTop: 18 }}><Button label={busy ? 'Planning…' : 'Plan it'} icon="star" disabled={busy || (prompt.trim().length + info.trim().length < 4)} onPress={plan} /></View>
      {err ? <Text style={st.err}>{err}</Text> : null}
    </View>
  );
}

// ── Personal invitation: a card on everyone's Home until they answer, reminders twice a day ──
export function InviteForm({ onDone }: { onDone: (msg: string) => void }) {
  const { content, saveContent, uploadPhoto, loadInviteResponses } = useStore();
  const upcomingEvents = content.events.filter((e) => e.end >= iso(new Date()));
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState("Hey {name}, we'd love to see you there. It won't be the same without you!");
  const [details, setDetails] = useState('');
  const [eventId, setEventId] = useState('');
  const [who, setWho] = useState<'Everyone' | 'Boys' | 'Girls'>('Everyone');
  const [days, setDays] = useState<'3 days' | '1 week' | '2 weeks'>('1 week');
  const [remind, setRemind] = useState(true);
  const [poster, setPoster] = useState<Snap[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, { name: string; answer: 'yes' | 'no' }[]> | null>(null);
  React.useEffect(() => { loadInviteResponses().then((r) => setResponses(r ?? {})); }, []);
  const opts = [{ v: '', l: 'No event' }, ...upcomingEvents.map((e) => ({ v: e.id, l: e.title }))];
  const pickEvent = (id: string) => {
    setEventId(id);
    const ev = content.events.find((e) => e.id === id);
    if (ev && !title.trim()) setTitle(ev.title);
  };
  const send = async () => {
    if (title.trim().length < 2) return setErr('What are you inviting them to?');
    setBusy(true); setErr(null);
    const urls = await publishPhotos(poster, uploadPhoto);
    if (typeof urls === 'string') { setBusy(false); return setErr(urls); }
    const ev = content.events.find((e) => e.id === eventId);
    const end = new Date(); end.setDate(end.getDate() + (days === '3 days' ? 3 : days === '1 week' ? 7 : 14));
    const until = ev && ev.end < iso(end) ? ev.end : iso(end);
    const invite = { id: 'i-' + Date.now().toString(36), on: true, title: title.trim(), message: message.trim(), details: details.trim(), eventId, image: urls[0] || ev?.poster || '', audience: (who === 'Boys' ? 'boys' : who === 'Girls' ? 'girls' : 'all') as 'all' | 'boys' | 'girls', until, remind, at: new Date().toISOString() };
    const e = await saveContent({ ...content, invites: [invite, ...(content.invites || [])] });
    setBusy(false);
    if (e) return setErr(e);
    onDone(`Invitation sent. It sits on everyone's Home until they answer${remind ? ', with a reminder twice a day' : ''}.`);
  };
  const toggle = async (id: string, on: boolean) => {
    await saveContent({ ...content, invites: (content.invites || []).map((v) => (v.id === id ? { ...v, on } : v)) });
  };
  return (
    <View>
      <Text style={st.h}>Invitation</Text>
      <Text style={st.sub}>A personal invite on everyone's Home with their name on it. It stays until they say yes or no.</Text>
      <Text style={[u.fieldLabel, { marginTop: 14 }]}>For an event (optional)</Text>
      <Chips wrap options={opts.map((o) => o.l)} value={opts.find((o) => o.v === eventId)?.l ?? 'No event'} onChange={(l) => pickEvent(opts.find((o) => o.l === l)?.v ?? '')} />
      <Field label="What it's for" value={title} onChange={setTitle} placeholder="Like: Bake shop night" />
      <Field label="Your message" value={message} onChange={setMessage} multiline hint="{name} turns into each teen's first name." />
      <Field label="More info (optional)" value={details} onChange={setDetails} multiline placeholder="What to bring, who's coming, anything else" />
      <PhotoPicker photos={poster} onChange={(p) => setPoster(p.slice(-1))} />
      <Text style={[u.fieldLabel, { marginTop: 14 }]}>Who gets it</Text>
      <Chips options={['Everyone', 'Boys', 'Girls'] as const} value={who} onChange={setWho} />
      <Text style={[u.fieldLabel, { marginTop: 14 }]}>Keep it up for</Text>
      <Chips options={['3 days', '1 week', '2 weeks'] as const} value={days} onChange={setDays} />
      <Switch title="Remind twice a day" sub="10 AM and 6 PM, until they answer" value={remind} onChange={setRemind} />
      <View style={{ marginTop: 20 }}><Button label={busy ? 'Sending…' : 'Send the invitation'} disabled={busy} onPress={send} /></View>
      {err ? <Text style={st.err}>{err}</Text> : null}

      {(content.invites || []).length ? (
        <View style={{ marginTop: 28 }}>
          <Text style={st.listHead}>Your invitations</Text>
          {(content.invites || []).map((v) => {
            const r = responses?.[v.id] ?? [];
            const yes = r.filter((x) => x.answer === 'yes'), no = r.filter((x) => x.answer === 'no');
            return (
              <View key={v.id} style={st.invRow}>
                <View style={{ flex: 1 }}>
                  <Text style={st.switchTitle}>{v.title}</Text>
                  <Text style={T.small}>{responses === null ? 'Loading…' : `${yes.length} in · ${no.length} not this time`}</Text>
                  {yes.length ? <Text style={st.names} numberOfLines={2}>{yes.map((x) => x.name.split(' ')[0]).join(', ')}</Text> : null}
                </View>
                <Toggle value={v.on} onChange={(on) => toggle(v.id, on)} label={`${v.title} is up`} />
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  h: { fontSize: 22, fontFamily: F.display, color: C.ink, letterSpacing: -0.3 },
  sub: { fontSize: 14, lineHeight: 20, color: C.sub, marginTop: 4 },
  switch: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, padding: 14, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  switchTitle: { fontSize: 15, fontWeight: '800', color: C.ink },
  err: { color: '#C0303F', marginTop: 12, fontSize: 14, fontWeight: '700' },
  listHead: { fontSize: 13, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: C.sub, marginBottom: 8 },
  invRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, marginBottom: 8 },
  names: { fontSize: 13, color: C.ink, marginTop: 4 },
  back: { fontSize: 15, fontWeight: '800', color: C.blue },
  aiHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#7C5CFC', alignItems: 'center', justifyContent: 'center' },
  seg: { flexDirection: 'row', gap: 6, padding: 4, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  segBtn: { flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: C.inverse },
  segText: { fontSize: 14, fontWeight: '800', color: C.ink },
});
