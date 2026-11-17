import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C, T } from './theme';
import { useStore, type MinyanRow, type Popup } from './store';
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
        <Text style={[T.h3, { flex: 1 }]}>Show the pop-up</Text>
        <Toggle value={on} onChange={setOn} label="Show the pop-up" />
      </View>
      <Field label="Title" value={title} onChange={setTitle} placeholder="Like: Tefillin Challenge is live" />
      <Field label="Message" value={body} onChange={setBody} placeholder="A sentence or two" multiline />
      <Field label="Button text (optional)" value={button} onChange={setButton} placeholder="Like: Join now" />
      <Text style={[st.label, { marginTop: 14 }]}>The button opens</Text>
      <Chips wrap options={opts.map((o) => o.l)} value={opts.find((o) => o.v === target)?.l ?? 'Nothing'} onChange={(l) => setTarget(opts.find((o) => o.l === l)?.v ?? '')} />
      <View style={{ marginTop: 20 }}>
        <Button label={busy ? 'Saving…' : 'Save'} disabled={busy || (on && title.trim().length < 2)} onPress={save} />
      </View>
      {err ? <Text style={st.err}>{err}</Text> : null}
    </View>
  );
}

// "Label | time" per line, the easiest thing to type on a phone.
const toText = (rows: MinyanRow[]) => rows.map((r) => (r.time ? `${r.label} | ${r.time}` : r.label)).join('\n');
const fromText = (s: string): MinyanRow[] => s.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
  const [label, ...rest] = l.split('|');
  return { label: label.trim(), time: rest.join('|').trim() };
});

export function MinyanEditor({ onDone }: { onDone: (msg: string) => void }) {
  const { content, saveContent } = useStore();
  const m = content.minyan ?? MINYAN_FALLBACK;
  const [weekday, setWeekday] = useState(toText(m.weekday));
  const [shabbat, setShabbat] = useState(toText(m.shabbat));
  const [note, setNote] = useState(m.note);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setErr(null);
    const e = await saveContent({ ...content, minyan: { weekday: fromText(weekday), shabbat: fromText(shabbat), note: note.trim() } });
    setBusy(false);
    if (e) return setErr(e);
    onDone('Minyan times saved. They show in the Chapter tab.');
  };
  return (
    <View>
      <Text style={T.h2}>Minyan times</Text>
      <Text style={[T.small, { marginTop: 4 }]}>One line each: name | time. Leave the time off to show "Call for times". Write "Candle lighting" or "10 min after Shabbat ends" and the app fills in this week's time.</Text>
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

const st = StyleSheet.create({
  toggleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18, padding: 14, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  label: { fontSize: 13, fontWeight: '800', color: C.sub },
  err: { color: '#C0303F', marginTop: 10, fontSize: 14 },
});
