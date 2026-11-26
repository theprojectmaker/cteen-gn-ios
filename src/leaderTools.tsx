import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from './icons';
import { pickPhotos, type Snap } from './photo';
import { C, HUES, R, T } from './theme';
import { challengeRules } from './challengeRules';
import { useStore, type AiDraft, type MinyanRow, type Popup } from './store';
import { Button, Chips, Field, Toggle } from './ui';
import { MINYAN_FALLBACK } from './minyan';

// Leader panel tools: the startup pop-up and the minyan times. Plain fields, one Save button.

export function PopupEditor({ onDone }: { onDone: (msg: string) => void }) {
  const { content, saveContent } = useStore();
  const cur = content.popup;
  const [on, setOn] = useState(cur?.on ?? true);
  const [title, setTitle] = useState(cur?.title ?? '');
  const [body, setBody] = useState(cur?.body ?? '');
  const [button, setButton] = useState(cur?.button ?? '');
  const opts = [
    { v: '', l: 'Nothing' },
    ...content.events.map((e) => ({ v: 'event:' + e.id, l: e.title })),
    ...content.challenges.map((c) => ({ v: 'challenge:' + c.id, l: c.title })),
    ...content.posts.slice(0, 10).map((p) => ({ v: 'post:' + p.id, l: p.title })),
  ];
  const [target, setTarget] = useState(cur?.target ? `${cur.target.type}:${cur.target.id}` : '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setErr(null);
    const [type, id] = target.split(':');
    const changed = !cur || cur.title !== title.trim() || cur.body !== body.trim();
    const popup: Popup = {
      ...(cur ?? {}),
      on, title: title.trim(), body: body.trim(), button: button.trim(),
      id: changed || !cur?.id ? 'p' + Date.now().toString(36) : cur.id,
      target: type ? { type: type as 'event' | 'challenge' | 'post', id } : null,
    };
    const e = await saveContent({ ...content, popup });
    setBusy(false);
    if (e) return setErr(e);
    onDone(on ? 'Pop-up is on. Everyone sees it when they open the app.' : 'Pop-up is off.');
  };
  return (
    <View>
      <Text style={T.h2}>Pop-up message</Text>
      <Text style={[T.small, { marginTop: 4 }]}>A card that shows every time someone opens the app, until you turn it off.</Text>
      <View style={st.toggleRow}>
        <Text style={[T.strong, { flex: 1 }]}>Show the pop-up</Text>
        <Toggle value={on} onChange={setOn} label="Show the pop-up" />
      </View>
      {cur?.image ? (
        <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Image source={{ uri: cur.image }} style={{ width: 64, height: 86, borderRadius: R.print, backgroundColor: C.raised }} resizeMode="cover" />
          <Text style={[T.small, { flex: 1 }]}>{cur.on ? 'This poster is showing every time the app opens. Turn the switch off and save to stop it.' : 'This poster is saved but not showing.'}</Text>
        </View>
      ) : null}
      <Field label="Title" value={title} onChange={setTitle} placeholder="Like: Tefillin Challenge is live" />
      <Field label="Message" value={body} onChange={setBody} placeholder="A sentence or two" multiline />
      <Field label="Button text (optional)" value={button} onChange={setButton} placeholder="Like: Join now" />
      <Text style={[st.label, { marginTop: 14 }]}>The button opens</Text>
      <Chips wrap options={opts.map((o) => o.l)} value={opts.find((o) => o.v === target)?.l ?? 'Nothing'} onChange={(l) => setTarget(opts.find((o) => o.l === l)?.v ?? '')} />
      <View style={{ marginTop: 20 }}>
        <Button label={busy ? 'Saving…' : on ? 'Save' : 'Save (pop-up off)'} disabled={busy || (on && title.trim().length < 2 && !cur?.image)} onPress={save} />
      </View>
      {err ? <Text style={st.err}>{err}</Text> : null}
    </View>
  );
}

// "Label | time" per line, the easiest thing to type on a phone.
// older saved times used codes; show them to the rabbi as plain words
const friendly = (time: string) => (time === '@candles' ? 'Candle lighting' : time.replace(/^@havdalah\+(\d+)$/, '$1 min after Shabbat ends'));
const toText = (rows: MinyanRow[]) => rows.map((r) => (r.time ? `${r.label} | ${friendly(r.time)}` : r.label)).join('\n');
const fromText = (s: string): MinyanRow[] => s.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
  const [label, ...rest] = l.split('|');
  return { label: label.trim(), time: rest.join('|').trim() };
});

export function MinyanEditor({ onDone }: { onDone: (msg: string) => void }) {
  const { content, saveContent, minyanFromText } = useStore();
  const m = content.minyan ?? MINYAN_FALLBACK;
  const [paste, setPaste] = useState('');
  const [reading, setReading] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const fillFromPaste = async () => {
    setReading(true); setErr(null); setAiNote(null);
    const r = await minyanFromText(paste);
    setReading(false);
    if ('error' in r) return setErr(r.error);
    setWeekday(toText(r.weekday)); setShabbat(toText(r.shabbat));
    setAiNote('Filled in from your message. Check the times below, then tap Save.');
  };
  const [weekday, setWeekday] = useState(toText(m.weekday));
  const [shabbat, setShabbat] = useState(toText(m.shabbat));
  const [note, setNote] = useState(m.note);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setErr(null);
    const e = await saveContent({ ...content, minyan: { ...content.minyan, weekday: fromText(weekday), shabbat: fromText(shabbat), note: note.trim() } });
    setBusy(false);
    if (e) return setErr(e);
    onDone('Minyan times saved. They show in the Chapter tab.');
  };
  return (
    <View>
      <Text style={T.h2}>Minyan times</Text>
      <Text style={[T.small, { marginTop: 4 }]}>One line each: name | time. Leave the time off to show "Call for times". Write "Candle lighting" or "10 min after Shabbat ends" and the app fills in this week's time.</Text>
      <View style={st.draft}>
        <Text style={T.strong}>Got the schedule on WhatsApp?</Text>
        <Text style={T.small}>Paste it here and the AI fills in the times for you. Nothing changes until you tap Save.</Text>
        <Field label="Schedule message" value={paste} onChange={setPaste} placeholder="Paste it here" multiline />
        <View style={{ marginTop: 10 }}><Button kind="ghost" icon="send" label={reading ? 'Reading…' : 'Fill in the times'} disabled={reading || paste.trim().length < 5} onPress={fillFromPaste} /></View>
        {aiNote ? <Text style={[st.draftTag, { marginTop: 10 }]}>{aiNote}</Text> : null}
      </View>
      <Field label="Weekdays" value={weekday} onChange={setWeekday} multiline />
      <Field label="Shabbat" value={shabbat} onChange={setShabbat} multiline />
      <Field label="Note (optional)" value={note} onChange={setNote} multiline />
      <View style={{ marginTop: 20 }}>
        <Button label={busy ? 'Saving…' : 'Save'} disabled={busy} onPress={save} />
      </View>
      {err ? <Text style={st.err}>{err}</Text> : null}
    </View>
  );
}

// ── Photos on posts ──
// Uploads each photo and returns their links, or an error message.
export async function publishPhotos(photos: Snap[], upload: (b64: string) => Promise<string | { error: string }>): Promise<string[] | string> {
  const urls: string[] = [];
  for (const p of photos) {
    const r = await upload(p.base64);
    if (typeof r !== 'string') return r.error;
    urls.push(r);
  }
  return urls;
}

export function PhotoPicker({ photos, onChange }: { photos: Snap[]; onChange: (p: Snap[]) => void }) {
  const [err, setErr] = useState<string | null>(null);
  const add = async () => {
    setErr(null);
    const r = await pickPhotos(4 - photos.length);
    if (!r) return;
    if ('error' in r) return setErr(r.error);
    onChange([...photos, ...r].slice(0, 4));
  };
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={st.label}>Photos (up to 4)</Text>
      <View style={st.thumbs}>
        {photos.map((p, i) => (
          <View key={p.uri + i} style={st.thumb}>
            <Image source={{ uri: p.uri }} style={StyleSheet.absoluteFill} />
            <Pressable onPress={() => onChange(photos.filter((_, j) => j !== i))} style={st.thumbX} hitSlop={6} accessibilityRole="button" accessibilityLabel="Remove photo">
              <Icon name="x" size={12} color={C.white} stroke={3} />
            </Pressable>
          </View>
        ))}
        {photos.length < 4 ? (
          <Pressable onPress={add} style={({ pressed }) => [st.thumb, st.thumbAdd, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel="Add photos">
            <Icon name="camera" size={22} color={C.blueDeep} stroke={2} />
            <Text style={st.thumbAddText}>Add</Text>
          </Pressable>
        ) : null}
      </View>
      {err ? <Text style={st.err}>{err}</Text> : null}
    </View>
  );
}

// ── WhatsApp → Feed post ──
// Paste the announcement, the AI writes a clean post (no emojis, same facts), the rabbi checks it and posts.
export function WhatsAppImport({ onDone }: { onDone: (msg: string) => void }) {
  const { content, saveContent, aiDraft, uploadPhoto } = useStore();
  const [raw, setRaw] = useState('');
  const [draft, setDraft] = useState<AiDraft | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<AiDraft['kind']>('News');
  const [addEvent, setAddEvent] = useState(true);
  const [photos, setPhotos] = useState<Snap[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const read = async () => {
    setBusy(true); setErr(null);
    const r = await aiDraft(raw);
    setBusy(false);
    if ('error' in r) return setErr(r.error);
    setDraft(r); setTitle(r.title); setBody(r.body); setKind(r.kind); setAddEvent(!!r.event);
  };
  const post = async () => {
    if (title.trim().length < 2) return setErr('Add a headline.');
    setBusy(true); setErr(null);
    const urls = await publishPhotos(photos, uploadPhoto);
    if (typeof urls === 'string') { setBusy(false); return setErr(urls); }
    const ev = draft?.event && addEvent ? {
      id: 'e-' + Date.now().toString(36), title: draft.event.title || title.trim(), icon: 'star', color: 'blue' as const, scope: 'gn' as const,
      start: draft.event.date, end: draft.event.date, time: draft.event.time, place: draft.event.place || 'Chabad of Great Neck', price: '', who: '', about: body.trim(),
      signup: 'app' as const, url: '', payUrl: '', gender: 'all' as const, minAge: null, maxAge: null,
    } : null;
    const p = { id: 'p-' + Date.now().toString(36), kind, pinned: false, title: title.trim(), body: body.trim(), eventId: ev ? ev.id : '', challengeId: '', photos: urls, linkLabel: '', linkUrl: '', at: new Date().toISOString() };
    const e = await saveContent({ ...content, posts: [p, ...content.posts], events: ev ? [...content.events, ev] : content.events });
    setBusy(false);
    if (e) return setErr(e);
    onDone(ev ? 'Posted, and the event was added with RSVP. Every phone got a notification.' : 'Posted to the Feed. Every phone got a notification.');
  };
  return (
    <View>
      <Text style={T.h2}>Import from WhatsApp</Text>
      <Text style={[T.small, { marginTop: 4 }]}>In WhatsApp, press and hold the message, tap Copy, then paste it here.</Text>
      <Field label="WhatsApp message" value={raw} onChange={setRaw} placeholder="Paste it here" multiline />
      <View style={{ marginTop: 12 }}>
        <Button kind={draft ? 'ghost' : 'primary'} icon="send" label={busy && !draft ? 'Reading…' : draft ? 'Try again' : 'Turn it into a post'} disabled={busy || raw.trim().length < 5} onPress={read} />
      </View>
      {draft ? (
        <View style={st.draft}>
          <Text style={st.draftTag}>AI draft. Check it, change anything, then post.</Text>
          <Field label="Headline" value={title} onChange={setTitle} />
          <Field label="Message" value={body} onChange={setBody} multiline />
          <Text style={[st.label, { marginTop: 14 }]}>Type</Text>
          <Chips options={['News', 'Events', 'Photos', 'Rewards', 'Food'] as const} value={kind} onChange={setKind} />
          {draft.event ? (
            <View style={st.eventBox}>
              <View style={{ flex: 1 }}>
                <Text style={T.strong}>Also add it as an event</Text>
                <Text style={T.small}>{[draft.event.title, draft.event.date, draft.event.time, draft.event.place].filter(Boolean).join(' · ')}</Text>
              </View>
              <Toggle value={addEvent} onChange={setAddEvent} label="Also add it as an event" />
            </View>
          ) : null}
          <PhotoPicker photos={photos} onChange={setPhotos} />
          <View style={{ marginTop: 18 }}>
            <Button label={busy ? 'Posting…' : 'Post it'} disabled={busy} onPress={post} />
          </View>
        </View>
      ) : null}
      {err ? <Text style={st.err}>{err}</Text> : null}
    </View>
  );
}

// ── Food: what's being served ──
// Shows on Home as "On the menu" for 4 days, and in the Feed. Every phone gets a notification.
export function FoodForm({ onDone }: { onDone: (msg: string) => void }) {
  const { content, saveContent, uploadPhoto } = useStore();
  const [what, setWhat] = useState('');
  const [when, setWhen] = useState('');
  const [photos, setPhotos] = useState<Snap[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const post = async () => {
    if (what.trim().length < 2) return setErr("Write what's on the menu.");
    setBusy(true); setErr(null);
    const urls = await publishPhotos(photos, uploadPhoto);
    if (typeof urls === 'string') { setBusy(false); return setErr(urls); }
    const p = { id: 'p-' + Date.now().toString(36), kind: 'Food' as const, pinned: false, title: what.trim(), body: when.trim(), eventId: '', challengeId: '', photos: urls, linkLabel: '', linkUrl: '', at: new Date().toISOString() };
    const e = await saveContent({ ...content, posts: [p, ...content.posts] });
    setBusy(false);
    if (e) return setErr(e);
    onDone("Food announced. It's on Home under On the menu, and every phone got a notification.");
  };
  return (
    <View>
      <Text style={T.h2}>Announce the food</Text>
      <Text style={[T.small, { marginTop: 4 }]}>Shows at the top of Home as "On the menu" for 4 days.</Text>
      <Field label="What's on the menu" value={what} onChange={setWhat} placeholder="Like: Pizza, wings and ice cream" />
      <Field label="When and where (optional)" value={when} onChange={setWhen} placeholder="Like: Friday night dinner after services" multiline />
      <PhotoPicker photos={photos} onChange={setPhotos} />
      <View style={{ marginTop: 20 }}>
        <Button label={busy ? 'Posting…' : 'Announce it'} disabled={busy} onPress={post} />
      </View>
      {err ? <Text style={st.err}>{err}</Text> : null}
    </View>
  );
}

// ── Challenges: title, description, rules, prize, color, cover photo, on/off ──
const HUE_KEYS = ['blue', 'orange', 'purple', 'green', 'pink', 'yellow'] as const;
export function ChallengeEditor({ onDone }: { onDone: (msg: string) => void }) {
  const { content, saveContent, uploadPhoto } = useStore();
  const list = content.challenges.filter((c) => !(c as { managed?: boolean }).managed);
  const [id, setId] = useState(list.find((c) => c.id === 'tefillin')?.id ?? list[0]?.id ?? '');
  const ch = list.find((c) => c.id === id);
  const [title, setTitle] = useState(ch?.title ?? '');
  const [about, setAbout] = useState(ch?.about ?? '');
  const [rules, setRules] = useState((ch ? challengeRules(ch) : []).join('\n'));
  const [prize, setPrize] = useState(ch?.rewards[ch.rewards.length - 1]?.prize ?? '');
  const [color, setColor] = useState<(typeof HUE_KEYS)[number]>((ch?.color as (typeof HUE_KEYS)[number]) ?? 'blue');
  const [active, setActive] = useState(ch?.active ?? true);
  const [cover, setCover] = useState<Snap[]>([]);
  const [image, setImage] = useState(ch?.image ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pick = (cid: string) => {
    const c = list.find((x) => x.id === cid);
    if (!c) return;
    setId(cid); setTitle(c.title); setAbout(c.about); setRules(challengeRules(c).join('\n'));
    setPrize(c.rewards[c.rewards.length - 1]?.prize ?? ''); setColor((c.color as (typeof HUE_KEYS)[number]) ?? 'blue');
    setActive(c.active); setCover([]); setImage(c.image ?? ''); setErr(null);
  };
  if (!ch) return <Text style={T.small}>No challenges yet. Add one in Expert mode.</Text>;
  const save = async () => {
    if (title.trim().length < 2) return setErr('Give it a name.');
    setBusy(true); setErr(null);
    let img = image;
    if (cover.length) {
      const r = await uploadPhoto(cover[0].base64);
      if (typeof r !== 'string') { setBusy(false); return setErr(r.error); }
      img = r;
    }
    const rewards = ch.rewards.length
      ? ch.rewards.map((r, i) => (i === ch.rewards.length - 1 ? { ...r, prize: prize.trim() || r.prize } : r))
      : prize.trim() ? [{ at: ch.goal, prize: prize.trim() }] : [];
    const next = {
      ...ch, title: title.trim(), about: about.trim(), color, active, image: img,
      rules: rules.split('\n').map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean).slice(0, 12),
      rewards,
    };
    const e = await saveContent({ ...content, challenges: content.challenges.map((c) => (c.id === ch.id ? next : c)) });
    setBusy(false);
    if (e) return setErr(e);
    onDone(`${next.title} saved. Teens see the new rules and look right away.`);
  };
  return (
    <View>
      <Text style={T.h2}>Challenges</Text>
      <Text style={[T.small, { marginTop: 4 }]}>Change how a challenge looks and what its rules say.</Text>
      {list.length > 1 ? (
        <View style={{ marginTop: 14 }}>
          <Chips wrap options={list.map((c) => c.title)} value={ch.title} onChange={(t) => pick(list.find((c) => c.title === t)?.id ?? id)} />
        </View>
      ) : null}
      <View style={st.toggleRow}>
        <Text style={[T.strong, { flex: 1 }]}>Live</Text>
        <Toggle value={active} onChange={setActive} label="Challenge is live" />
      </View>
      <Field label="Name" value={title} onChange={setTitle} />
      <Field label="Short description" value={about} onChange={setAbout} multiline />
      <Field label="Rules (one per line)" value={rules} onChange={setRules} multiline hint="These show in the Rules pop-up, numbered." />
      <Field label="Prize for finishing" value={prize} onChange={setPrize} placeholder="Like: Luxury EZRI backpack" />
      <Text style={[st.label, { marginTop: 14 }]}>Color</Text>
      <View style={st.colors}>
        {HUE_KEYS.map((k) => (
          <Pressable key={k} onPress={() => setColor(k)} style={[st.swatch, { backgroundColor: HUES[k].solid }, color === k && st.swatchOn]} accessibilityRole="button" accessibilityLabel={k} accessibilityState={{ selected: color === k }} />
        ))}
      </View>
      <Text style={[st.label, { marginTop: 14 }]}>Cover photo (optional)</Text>
      {image && !cover.length ? (
        <View style={st.coverRow}>
          <Image source={{ uri: image }} style={st.coverThumb} />
          <Pressable onPress={() => setImage('')} hitSlop={8} accessibilityRole="button"><Text style={st.removeText}>Remove cover</Text></Pressable>
        </View>
      ) : null}
      <PhotoPicker photos={cover} onChange={(p) => setCover(p.slice(-1))} />
      <View style={{ marginTop: 20 }}>
        <Button label={busy ? 'Saving…' : 'Save'} disabled={busy} onPress={save} />
      </View>
      {err ? <Text style={st.err}>{err}</Text> : null}
    </View>
  );
}

const st = StyleSheet.create({
  toggleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18, padding: 14, borderRadius: R.card, backgroundColor: C.card },
  label: { ...T.eyebrow, marginBottom: 2 },
  err: { color: C.red, marginTop: 10, fontSize: 14, fontWeight: '600' },
  colors: { flexDirection: 'row', gap: 12, marginTop: 8 },
  swatch: { width: 36, height: 36, borderRadius: 18 },
  swatchOn: { borderWidth: 3, borderColor: C.ink },
  coverRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  coverThumb: { width: 96, height: 60, borderRadius: R.print, backgroundColor: C.raised },
  removeText: { fontSize: 14, fontWeight: '700', color: C.red },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  thumb: { width: 76, height: 76, borderRadius: R.photo, overflow: 'hidden', backgroundColor: C.raised },
  thumbX: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  thumbAdd: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', borderWidth: 1, borderColor: C.blue, borderStyle: 'dashed' },
  thumbAddText: { fontSize: 12, fontWeight: '700', color: C.blueDeep, marginTop: 2 },
  draft: { marginTop: 18, padding: 14, borderRadius: R.card, backgroundColor: C.card },
  draftTag: { fontSize: 12.5, fontWeight: '700', color: C.blueDeep },
  eventBox: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, padding: 12, borderRadius: R.chip, backgroundColor: C.raised },
});
