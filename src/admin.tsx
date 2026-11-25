import React, { useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AiPlanner, EventForm, InviteForm, PosterForm } from './leaderEvents';
import { ChallengeEditor, FoodForm, MinyanEditor, PhotoPicker, PopupEditor, WhatsAppImport, publishPhotos } from './leaderTools';
import type { Snap } from './photo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, T, F } from './theme';
import { EVENT_ICONS, Icon } from './icons';
import { dateLabel, todayIso, upcoming, useStore, type Content, type Person, type PhotoRow, type Question, type SignupRow, type Target } from './store';
import { Button, Card, Chips, Field, IconTile, Toggle, s as u } from './ui';

// ───────── form description ─────────
type Opt = { v: string; l: string };
type Spec = { k: string; label: string; t: 'text' | 'long' | 'pick' | 'bool' | 'lines'; opts?: Opt[]; hint?: string; ph?: string; show?: (d: Draft) => boolean };
type Draft = Record<string, string | boolean>;
type Section = 'Posts' | 'Events' | 'Challenges' | 'Photos' | 'Live banner' | 'Info' | 'Sign-ups' | 'People' | 'Inbox';
type ListKey = 'posts' | 'events' | 'challenges' | 'info';

const cap = (v: string) => v[0].toUpperCase() + v.slice(1);
const COLORS: Opt[] = ['blue', 'orange', 'purple', 'green', 'pink', 'yellow'].map((v) => ({ v, l: cap(v) }));
const ICONS: Opt[] = EVENT_ICONS.map((v) => ({ v, l: cap(v) }));
const NONE: Opt = { v: '', l: 'None' };
const targetOpts = (c: Content): Opt[] => [{ v: '', l: 'Nothing' }, ...c.events.map((e) => ({ v: 'event:' + e.id, l: e.title })), ...c.challenges.map((x) => ({ v: 'challenge:' + x.id, l: x.title }))];
const toTarget = (v: string): Target => {
  const [type, id] = v.split(':');
  return id ? { type: type as 'event' | 'challenge', id } : null;
};

function specs(key: ListKey, c: Content, isNew: boolean): Spec[] {
  const events = c.events.map((e) => ({ v: e.id, l: e.title }));
  const challenges = c.challenges.map((x) => ({ v: x.id, l: x.title }));
  const notify: Spec[] = isNew ? [{ k: '_notify', label: 'Also send a notification to every phone', t: 'bool' }] : [];
  if (key === 'posts') return [
    { k: 'title', label: 'Headline', t: 'text', ph: 'Pizza in the sukkah this Thursday' },
    { k: 'body', label: 'Message', t: 'long' },
    { k: 'kind', label: 'Type', t: 'pick', opts: ['News', 'Events', 'Photos', 'Rewards'].map((v) => ({ v, l: v })) },
    { k: 'pinned', label: 'Pin to the top of the feed', t: 'bool' },
    { k: 'eventId', label: 'Attach an event', t: 'pick', opts: [NONE, ...events] },
    { k: 'challengeId', label: 'Attach a challenge', t: 'pick', opts: [NONE, ...challenges] },
    { k: 'photos', label: 'Photos', t: 'lines', hint: 'Paste image links (https://…), one per line.' },
    { k: 'linkLabel', label: 'Button text (optional)', t: 'text', ph: 'Sign up here' },
    { k: 'linkUrl', label: 'Button link (optional)', t: 'text', ph: 'https://…' },
  ];
  if (key === 'events') return [
    { k: 'title', label: 'Event name', t: 'text', ph: 'Mega Chanukah Party' },
    { k: 'scope', label: 'Whose event is it?', t: 'pick', opts: [{ v: 'gn', l: 'Great Neck' }, { v: 'intl', l: 'International' }] },
    { k: 'signup', label: 'How do teens register?', t: 'pick', opts: [{ v: 'app', l: 'Sign up in the app' }, { v: 'link', l: 'On a website' }] },
    { k: 'url', label: 'Registration website', t: 'text', ph: 'https://myportal.cteen.com/…', show: (d) => d.signup === 'link' },
    { k: 'payUrl', label: 'Ticket / payment link (optional)', t: 'text', ph: 'https://…', show: (d) => d.signup === 'app' },
    { k: 'start', label: 'Start date', t: 'text', ph: '2026-12-10', hint: 'Year-month-day, like 2026-12-10.' },
    { k: 'end', label: 'End date', t: 'text', ph: 'Same as start for a one-day event' },
    { k: 'repeat', label: 'Repeats', t: 'pick', opts: [{ v: 'none', l: 'Once' }, { v: 'weekly', l: 'Every week' }], hint: 'Every week: it comes back on the same weekday as the start date.' },
    { k: 'time', label: 'Time (optional)', t: 'text', ph: '7:00 PM' },
    { k: 'place', label: 'Where (optional)', t: 'text', ph: 'Chabad of Great Neck' },
    { k: 'price', label: 'Price (optional)', t: 'text', ph: 'Free' },
    { k: 'icon', label: 'Cover icon', t: 'pick', opts: ICONS },
    { k: 'color', label: 'Cover color', t: 'pick', opts: COLORS },
    { k: 'gender', label: 'Who can see it', t: 'pick', opts: [{ v: 'all', l: 'Everyone' }, { v: 'girls', l: 'Girls only' }, { v: 'boys', l: 'Boys only' }] },
    { k: 'minAge', label: 'Youngest age (optional)', t: 'text', ph: '13', hint: 'Teens younger than this will not see the event.' },
    { k: 'maxAge', label: 'Oldest age (optional)', t: 'text', ph: '18' },
    { k: 'who', label: "Who it's for (optional)", t: 'text' },
    { k: 'about', label: 'Details', t: 'long' },
    { k: 'priority', label: 'Featured event (shows first and stands out)', t: 'bool' },
  ];
  if (key === 'challenges') return [
    { k: 'title', label: 'Challenge name', t: 'text', ph: 'Tefillin Challenge' },
    { k: 'active', label: 'Live (shows on Home)', t: 'bool' },
    { k: 'photo', label: 'Check in with a photo (you can review them in Photos)', t: 'bool' },
    { k: 'every', label: 'Check in', t: 'pick', opts: [{ v: 'day', l: 'Once a day' }, { v: 'week', l: 'Once a week' }] },
    { k: 'goal', label: 'Goal (number of check-ins)', t: 'text', ph: '30' },
    { k: 'about', label: 'How it works', t: 'long' },
    { k: 'rewards', label: 'Rewards', t: 'lines', hint: 'One per line as "number = prize", like: 5 = CTeen hoodie' },
    { k: 'icon', label: 'Icon', t: 'pick', opts: ICONS },
    { k: 'color', label: 'Color', t: 'pick', opts: COLORS },
    ...notify,
  ];
  return [
    { k: 'title', label: 'Title', t: 'text' },
    { k: 'body', label: 'Text', t: 'long' },
    { k: 'icon', label: 'Icon', t: 'pick', opts: ICONS },
  ];
}

const BLANK: Record<ListKey, Draft> = {
  posts: { title: '', body: '', kind: 'News', pinned: false, eventId: '', challengeId: '', photos: '', linkLabel: '', linkUrl: '', _notify: false },
  events: { title: '', scope: 'gn', signup: 'app', url: '', payUrl: '', start: '', end: '', time: '', place: '', price: '', icon: 'star', color: 'blue', who: '', about: '', image: '', gender: 'all', minAge: '', maxAge: '', repeat: 'none', repeatUntil: '', priority: false, fullPoster: false, cover: '', poster: '', _notify: false },
  challenges: { title: '', icon: 'trophy', color: 'purple', every: 'day', goal: '30', about: '', rewards: '', active: true, photo: false, _notify: false },
  info: { icon: 'star', title: '', body: '' },
};

// content item -> editable draft (everything becomes a string or boolean)
function toDraft(key: ListKey, item: any): Draft {
  const d: Draft = { ...BLANK[key] };
  for (const k of Object.keys(item)) {
    const v = item[k];
    if (k === 'photos') d.photos = (v ?? []).join('\n');
    else if (k === 'rewards') d.rewards = (v ?? []).map((r: { at: number; prize: string }) => `${r.at} = ${r.prize}`).join('\n');
    else if (typeof v === 'boolean') d[k] = v;
    else d[k] = v == null ? '' : String(v);
  }
  return d;
}
function fromDraft(key: ListKey, d: Draft): any {
  const { _notify, ...out }: any = { ...d };
  if (key === 'posts') {
    out.photos = String(d.photos).split('\n').map((x) => x.trim()).filter(Boolean);
    out.at = d.at || todayIso();
  }
  if (key === 'events') {
    out.end = d.end || d.start;
    out.minAge = String(d.minAge).trim() ? Number(d.minAge) : null;
    out.maxAge = String(d.maxAge).trim() ? Number(d.maxAge) : null;
  }
  if (key === 'challenges') {
    out.goal = Number(d.goal) || 1;
    out.rewards = String(d.rewards).split('\n').map((line) => /^\s*(\d+)\s*[=:\-]\s*(.+)$/.exec(line)).filter(Boolean).map((m) => ({ at: Number(m![1]), prize: m![2].trim() }));
  }
  return out;
}
function problem(key: ListKey, d: Draft): string | null {
  if (String(d.title).trim().length < 2) return 'Add a name first.';
  if (key === 'events') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.start))) return 'Start date needs to look like 2026-12-10.';
    if (d.end && !/^\d{4}-\d{2}-\d{2}$/.test(String(d.end))) return 'End date needs to look like 2026-12-11.';
    if (d.signup === 'link' && !/^https:\/\//.test(String(d.url))) return 'Add the registration website (starting with https://).';
  }
  return null;
}

function Form({ list, draft, set }: { list: Spec[]; draft: Draft; set: (d: Draft) => void }) {
  return (
    <>
      {list.filter((f) => !f.show || f.show(draft)).map((f) => {
        const v = draft[f.k];
        if (f.t === 'bool') return (
          <View key={f.k} style={st.toggle}>
            <Text style={[T.h3, { flex: 1 }]}>{f.label}</Text>
            <Toggle value={!!v} onChange={(x) => set({ ...draft, [f.k]: x })} label={f.label} />
          </View>
        );
        if (f.t === 'pick') return (
          <View key={f.k} style={{ marginTop: 14 }}>
            <Text style={u.fieldLabel}>{f.label}</Text>
            <Chips wrap options={f.opts!.map((o) => o.l)} value={f.opts!.find((o) => o.v === v)?.l ?? f.opts![0].l} onChange={(l) => set({ ...draft, [f.k]: f.opts!.find((o) => o.l === l)!.v })} />
          </View>
        );
        return <Field key={f.k} label={f.label} value={String(v ?? '')} onChange={(x) => set({ ...draft, [f.k]: x })} placeholder={f.ph} hint={f.hint} multiline={f.t !== 'text'} />;
      })}
    </>
  );
}

const LISTS: Record<'Posts' | 'Events' | 'Challenges' | 'Info', { key: ListKey; one: string; prefix: string }> = {
  Posts: { key: 'posts', one: 'post', prefix: 'p' },
  Events: { key: 'events', one: 'event', prefix: 'e' },
  Challenges: { key: 'challenges', one: 'challenge', prefix: 'c' },
  Info: { key: 'info', one: 'info card', prefix: 'i' },
};
const SECTIONS = ['Posts', 'Events', 'Challenges', 'Photos', 'Live banner', 'Info', 'Sign-ups', 'People', 'Inbox'] as const;
const DURATIONS = [{ l: '1 hour', h: 1 }, { l: 'Today', h: 12 }, { l: '3 days', h: 72 }, { l: '1 week', h: 168 }, { l: 'Until I turn it off', h: 0 }];

export function AdminPanel() {
  const insets = useSafeAreaInsets();
  const store = useStore();
  const { adminOpen, setAdminOpen, leader, content, saveContent } = store;
  const [task, setTask] = useState<Task | null>(null);
  const [inSection, setInSection] = useState<Section | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [live, setLive] = useState<Draft>({ title: '', text: '', target: '', hours: 'Today', push: true });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [signups, setSignups] = useState<{ signups: Record<string, SignupRow[]>; phones: number } | null>(null);
  const [inbox, setInbox] = useState<Question[] | null>(null);
  const [coverPick, setCoverPick] = useState<Snap[]>([]);

  useEffect(() => { setEditing(null); setNote(null); setConfirmDel(false); }, [inSection, task, adminOpen]);
  useEffect(() => { setCoverPick([]); }, [editing?.id, inSection, adminOpen]);
  // Every task opens at its top, not wherever the list was scrolled to.
  const scroller = useRef<ScrollView>(null);
  useEffect(() => { scroller.current?.scrollTo({ y: 0, animated: false }); }, [task, inSection, editing?.id]);
  useEffect(() => {
    if (!leader || !adminOpen) return;
    if (inSection === 'Sign-ups') { setSignups(null); store.loadSignups().then((r) => setSignups(r ?? { signups: {}, phones: 0 })); }
    if (inSection === 'Inbox') { setInbox(null); store.loadInbox().then((r) => setInbox(r ?? [])); }
  }, [inSection, leader, adminOpen]);

  if (!adminOpen) return null;

  const home = () => { setTask(null); setInSection(null); setEditing(null); setConfirmDel(false); };
  const done = (msg: string) => { home(); setNote(msg); };
  const save = async (next: Content, doneMsg: string) => {
    setBusy(true); setNote(null);
    const err = await saveContent(next);
    setBusy(false);
    setNote(err ?? doneMsg);
    return !err;
  };
  const back = () => (
    <Pressable onPress={home} style={st.backRow} hitSlop={8} accessibilityRole="button">
      <View style={{ transform: [{ scaleX: -1 }] }}><Icon name="right" size={18} color={C.blueDeep} stroke={2.4} /></View>
      <Text style={st.backText}>All tasks</Text>
    </Pressable>
  );

  const form = (t: Task): React.ReactNode => {
    switch (t) {
      case 'event': return <EventForm onDone={done} />;
      case 'invite': return <InviteForm onDone={done} />;
      case 'poster': return <PosterForm onDone={done} />;
      case 'ai': return <AiPlanner onDone={done} />;
      case 'food': return <FoodForm onDone={done} />;
      case 'whatsapp': return <WhatsAppImport onDone={done} />;
      case 'popup': return <PopupEditor onDone={done} />;
      case 'minyan': return <MinyanEditor onDone={done} />;
      case 'post': case 'alert': case 'notify': return <SimpleForm kind={t} onDone={done} />;
      case 'remind': return <SimpleForm kind="notify" link={'challenge:' + (content.challenges.find((c) => c.active)?.id ?? '')} onDone={done} />;
      default: return null;
    }
  };

  // The Manage section views (who's coming, photos, people, questions) and the full list editors.
  const sectionBody = (): React.ReactNode => {
    if (inSection === 'Live banner') {
      const a = content.alert;
      const on = a.on && (!a.until || a.until > new Date().toISOString());
      return (
        <View style={{ gap: 12 }}>
          <Card>
            <Text style={T.eyebrow}>{on ? 'Live right now' : 'No banner showing'}</Text>
            {on ? (
              <>
                <Text style={[T.h2, { marginTop: 6 }]}>{a.title}</Text>
                {a.text ? <Text style={[T.small, { marginTop: 2 }]}>{a.text}</Text> : null}
                <View style={{ marginTop: 12, alignSelf: 'flex-start' }}>
                  <Button small kind="danger" label={busy ? 'Turning off…' : 'Turn off banner'} disabled={busy} onPress={async () => { setBusy(true); setNote(await store.sendAlert(null)); setBusy(false); }} />
                </View>
              </>
            ) : <Text style={[T.small, { marginTop: 6 }]}>Send one below. It appears at the top of every screen within about 30 seconds.</Text>}
          </Card>
          <Card>
            <Text style={T.h2}>Send a live banner</Text>
            <Field label="Title" value={String(live.title)} onChange={(x) => setLive({ ...live, title: x })} placeholder="Pizza night moved to 8 PM" />
            <Field label="More detail (optional)" value={String(live.text)} onChange={(x) => setLive({ ...live, text: x })} placeholder="Same place. Bring a friend." />
            <View style={{ marginTop: 14 }}>
              <Text style={u.fieldLabel}>Tapping it opens</Text>
              <Chips wrap options={targetOpts(content).map((o) => o.l)} value={targetOpts(content).find((o) => o.v === live.target)?.l ?? 'Nothing'} onChange={(l) => setLive({ ...live, target: targetOpts(content).find((o) => o.l === l)!.v })} />
            </View>
            <View style={{ marginTop: 14 }}>
              <Text style={u.fieldLabel}>Show it for</Text>
              <Chips wrap options={DURATIONS.map((d) => d.l)} value={String(live.hours)} onChange={(l) => setLive({ ...live, hours: l })} />
            </View>
            <View style={st.toggle}>
              <Text style={[T.h3, { flex: 1 }]}>Also send as a notification to every phone</Text>
              <Toggle value={!!live.push} onChange={(x) => setLive({ ...live, push: x })} label="Also send as a notification" />
            </View>
            <View style={{ marginTop: 18 }}>
              <Button icon="megaphone" label={busy ? 'Sending…' : 'Send to everyone'} disabled={busy || String(live.title).trim().length < 2} onPress={async () => {
                setBusy(true);
                setNote(await store.sendAlert({ title: String(live.title), text: String(live.text), target: toTarget(String(live.target)), hours: DURATIONS.find((d) => d.l === live.hours)?.h ?? 12, push: !!live.push }));
                setBusy(false);
                setLive({ ...live, title: '', text: '' });
              }} />
            </View>
          </Card>
        </View>
      );
    }
    if (inSection === 'Sign-ups') {
      const evs = content.events.filter((e) => e.signup === 'app');
      return (
        <View style={{ gap: 12 }}>
          {signups === null ? <Text style={T.small}>Loading sign-ups…</Text> : <Text style={T.small}>{signups.phones} phone{signups.phones === 1 ? ' has' : 's have'} notifications turned on.</Text>}
          {signups && evs.length === 0 ? <Text style={T.small}>No Great Neck events take in-app sign-ups yet.</Text> : null}
          {signups ? evs.map((e) => {
            const rows = signups.signups[e.id] ?? [];
            return (
              <Card key={e.id}>
                <Text style={T.h2}>{e.title}</Text>
                <Text style={[T.small, { marginTop: 2 }]}>{dateLabel(e)} · {rows.length} signed up</Text>
                {rows.map((r, i) => (
                  <View key={i} style={st.signRow}>
                    <Text style={[T.h3, { flex: 1 }]}>{r.name}</Text>
                    <Text style={T.small}>{[r.grade ? `Grade ${r.grade}` : '', r.age ? `Age ${r.age}` : '', r.gender === 'girl' ? 'Girl' : r.gender === 'boy' ? 'Boy' : ''].filter(Boolean).join(' · ')}</Text>
                  </View>
                ))}
              </Card>
            );
          }) : null}
        </View>
      );
    }
    if (inSection === 'People') return <PeopleView />;
    if (inSection === 'Photos') return <PhotoReview />;
    if (inSection === 'Inbox') return (
      <View style={{ gap: 12 }}>
        {inbox === null ? <Text style={T.small}>Loading questions…</Text> : inbox.length === 0 ? <Text style={T.small}>No questions yet. Teens send them from "Ask the rabbi" in the Chapter tab.</Text> : null}
        {(inbox ?? []).map((q) => (
          <Card key={q.id}>
            <Text style={T.eyebrow}>{q.name} · {new Date(q.at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</Text>
            <Text style={[T.body, { marginTop: 6 }]}>{q.text}</Text>
            <View style={{ marginTop: 12, alignSelf: 'flex-start' }}>
              <Button small kind="ghost" icon="tick" label="Done, remove" onPress={() => { setInbox((inbox ?? []).filter((x) => x.id !== q.id)); store.removeQuestion(q.id); }} />
            </View>
          </Card>
        ))}
      </View>
    );
    // list editors: Posts / Events / Challenges / Info
    const cfg = LISTS[inSection as 'Posts' | 'Events' | 'Challenges' | 'Info'];
    const items = content[cfg.key] as any[];
    if (editing) {
      const d = editing.draft;
      const submit = async () => {
        const p = problem(cfg.key, d);
        if (p) return setNote(p);
        let cover = String(d.cover || '');
        if (cfg.key === 'events' && coverPick.length) {
          setBusy(true);
          const urls = await publishPhotos(coverPick, store.uploadPhoto);
          setBusy(false);
          if (typeof urls === 'string') return setNote(urls);
          cover = urls[0] || cover;
        }
        const item = fromDraft(cfg.key, { ...d, ...(cfg.key === 'events' ? { cover } : {}), id: editing.id ?? cfg.prefix + '-' + Date.now().toString(36) });
        const nextList = editing.id ? items.map((x) => (x.id === editing.id ? item : x)) : [item, ...items];
        const auto = !editing.id && (cfg.key === 'posts' || cfg.key === 'events');
        if (!(await save({ ...content, [cfg.key]: nextList }, editing.id ? 'Saved.' : auto ? 'Live for everyone. Every phone got a notification.' : 'Live for everyone.'))) return;
        if (!editing.id && d._notify && cfg.key === 'challenges') {
          const target: Target = { type: 'challenge', id: item.id };
          const sent = await store.sendPush(`New challenge: ${item.title}`, 'Open CTeen GN to join.', target);
          setNote('Live for everyone. ' + sent);
        }
        setEditing(null);
      };
      return (
        <Card>
          <Text style={T.h2}>{editing.id ? `Edit ${cfg.one}` : `New ${cfg.one}`}</Text>
          <Form list={specs(cfg.key, content, !editing.id)} draft={d} set={(draft) => setEditing({ ...editing, draft })} />
          {cfg.key === 'events' ? (
            <View style={{ marginTop: 16 }}>
              <Text style={u.fieldLabel}>Cover photo (shows on Home and the Events page)</Text>
              {d.cover && !coverPick.length ? (
                <View style={st.coverRow}>
                  <Image source={{ uri: String(d.cover) }} style={st.coverThumb} resizeMode="cover" />
                  <Pressable onPress={() => setEditing({ ...editing, draft: { ...d, cover: '', fullPoster: false } })} hitSlop={8} accessibilityRole="button"><Text style={st.turnOff}>Remove photo</Text></Pressable>
                </View>
              ) : null}
              <PhotoPicker photos={coverPick} onChange={(p) => setCoverPick(p.slice(-1))} />
              {d.cover || coverPick.length ? (
                <View style={st.toggle}>
                  <Text style={[T.h3, { flex: 1, fontSize: 16 }]}>This cover is a full poster (show it whole, no text over it)</Text>
                  <Toggle value={!!d.fullPoster} onChange={(x) => setEditing({ ...editing, draft: { ...d, fullPoster: x } })} label="Cover is a full poster" />
                </View>
              ) : null}
            </View>
          ) : null}
          <View style={{ marginTop: 18, gap: 10 }}>
            <Button label={busy ? 'Saving…' : editing.id ? 'Save changes' : cfg.key === 'posts' ? 'Post it' : `Add ${cfg.one}`} disabled={busy} onPress={submit} />
            <Button kind="ghost" label="Cancel" onPress={() => setEditing(null)} />
            {editing.id ? (
              <Button kind="danger" label={confirmDel ? 'Tap again to delete for everyone' : `Delete this ${cfg.one}`} disabled={busy} onPress={async () => {
                if (!confirmDel) return setConfirmDel(true);
                if (await save({ ...content, [cfg.key]: items.filter((x) => x.id !== editing.id) }, 'Deleted.')) setEditing(null);
              }} />
            ) : null}
          </View>
        </Card>
      );
    }
    return (
      <View style={{ gap: 10 }}>
        <Button icon="plus" label={`New ${cfg.one}`} onPress={() => { setNote(null); setConfirmDel(false); setEditing({ id: null, draft: { ...BLANK[cfg.key] } }); }} />
        {cfg.key === 'challenges' ? <Text style={T.small}>Flip a switch to turn a challenge on. Every live challenge shows as a banner on Home.</Text> : null}
        {items.map((x) => (
          <Card key={x.id} style={st.item}>
            <Pressable style={st.itemMain} onPress={() => { setNote(null); setConfirmDel(false); setEditing({ id: x.id, draft: toDraft(cfg.key, x) }); }} accessibilityRole="button" accessibilityLabel={`Edit ${x.title}`}>
              <IconTile icon={x.icon || (cfg.key === 'posts' ? (x.pinned ? 'pinned' : 'chat') : 'star')} color={x.color} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={T.h3} numberOfLines={1}>{x.title}</Text>
                <Text style={T.small} numberOfLines={1}>
                  {cfg.key === 'events' ? `${x.scope === 'gn' ? 'Great Neck' : 'International'} · ${dateLabel(x)}` : cfg.key === 'challenges' ? `${x.active ? 'Live' : 'Off'} · goal ${x.goal} · tap to edit` : cfg.key === 'posts' ? `${x.kind} · ${x.at}` : x.body}
                </Text>
              </View>
            </Pressable>
            {cfg.key === 'challenges' ? (
              <Toggle value={!!x.active} label={`${x.title} is live`} onChange={(v) => save({ ...content, challenges: content.challenges.map((c) => (c.id === x.id ? { ...c, active: v } : c)) }, v ? `${x.title} is live. Teens see the banner on Home.` : `${x.title} is off.`)} />
            ) : <Icon name="right" size={17} color={C.faint} stroke={2.4} />}
          </Card>
        ))}
        {items.length === 0 ? <Text style={[T.small, { textAlign: 'center', marginTop: 10 }]}>Nothing here yet.</Text> : null}
      </View>
    );
  };

  return (
    <Modal visible animationType="slide" onRequestClose={() => setAdminOpen(false)}>
      <View style={[st.root, { paddingTop: insets.top + 10 }]}>
        <View style={st.col}>
          <View style={st.top}>
            <View style={{ flex: 1 }}>
              <Text style={T.eyebrow}>CTeen Great Neck</Text>
              <Text style={[T.h1, { fontSize: 26 }]}>Leader panel</Text>
            </View>
            <Pressable onPress={() => setAdminOpen(false)} style={st.close} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close leader panel">
              <Icon name="x" size={18} color={C.ink} stroke={2.4} />
            </Pressable>
          </View>
        </View>
        <ScrollView ref={scroller} automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive" style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 16, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
          <View style={st.col}>
            {note ? <Text style={st.note} accessibilityLiveRegion="polite">{note}</Text> : null}
            {!leader ? (
              <Card>
                <IconTile icon="lock" size={48} />
                <Text style={[T.h2, { marginTop: 12 }]}>Leaders only</Text>
                <Text style={[T.small, { marginTop: 4 }]}>This is for Rabbi Zevy and the chapter leaders. If you should have it, ask Rabbi Zevy to add you as a leader — then it shows up here on its own.</Text>
              </Card>
            ) : task ? (
              <View>{back()}{form(task)}</View>
            ) : inSection ? (
              <View>{back()}{sectionBody()}</View>
            ) : (
              <Home
                onCreate={(t) => { setNote(null); setTask(t); }}
                onManage={(s) => { setNote(null); setInSection(s); }}
                onMinyan={() => { setNote(null); setTask('minyan'); }}
                onCompose={() => { setAdminOpen(false); setTimeout(() => store.setComposerOpen(true), 450); }}
              />
            )}
            {leader && !task && !inSection ? (
              <Pressable onPress={store.leaderLogout} style={{ alignSelf: 'center', marginTop: 24 }} hitSlop={8} accessibilityRole="button">
                <Text style={[T.small, { textDecorationLine: 'underline' }]}>Sign out of the leader panel</Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ───────── the panel home ─────────
type Task = 'post' | 'notify' | 'remind' | 'poster' | 'ai' | 'invite' | 'whatsapp' | 'food' | 'event' | 'alert' | 'popup' | 'minyan';
type TileColor = 'blue' | 'orange' | 'purple' | 'green' | 'pink' | 'yellow';

function Home({ onCreate, onManage, onMinyan, onCompose }: { onCreate: (t: Task) => void; onManage: (s: Section) => void; onMinyan: () => void; onCompose: () => void }) {
  const { content, sendAlert, saveContent, leader } = useStore();
  const [busy, setBusy] = useState<string | null>(null);
  const alertOn = content.alert?.on && (!content.alert.until || content.alert.until > new Date().toISOString()) ? content.alert : null;
  const popupOn = content.popup?.on && (content.popup.title || content.popup.image) ? content.popup : null;
  const create: { k: Task | 'compose'; icon: string; color: TileColor; title: string }[] = [
    { k: 'compose', icon: 'camera', color: 'blue', title: 'New post' },
    { k: 'event', icon: 'calendar', color: 'orange', title: 'Event' },
    { k: 'invite', icon: 'send', color: 'orange', title: 'Invitation' },
    { k: 'poster', icon: 'ticket', color: 'pink', title: 'Poster' },
    { k: 'notify', icon: 'bell', color: 'blue', title: 'Notification' },
    { k: 'alert', icon: 'megaphone', color: 'pink', title: 'Live banner' },
    ...(content.challenges.some((c) => c.active) ? [{ k: 'remind' as const, icon: 'clock', color: 'green' as const, title: 'Challenge reminder' }] : []),
    { k: 'food', icon: 'food', color: 'yellow', title: 'Food' },
    { k: 'popup', icon: 'star', color: 'purple', title: 'Pop-up' },
    { k: 'ai', icon: 'star', color: 'purple', title: 'AI planner' },
    { k: 'whatsapp', icon: 'send', color: 'green', title: 'From WhatsApp' },
  ];
  const manage: { icon: string; title: string; go: () => void }[] = [
    { icon: 'users', title: "Who's coming", go: () => onManage('Sign-ups') },
    { icon: 'camera', title: 'Tefillin photos', go: () => onManage('Photos') },
    { icon: 'chat', title: 'Feed posts', go: () => onManage('Posts') },
    { icon: 'calendar', title: 'Events', go: () => onManage('Events') },
    { icon: 'tefillin', title: 'Challenges & rules', go: () => onManage('Challenges') },
    { icon: 'compass', title: 'Chapter info', go: () => onManage('Info') },
    { icon: 'clock', title: 'Minyan times', go: onMinyan },
    { icon: 'question', title: 'Questions from teens', go: () => onManage('Inbox') },
    { icon: 'user', title: 'People & leaders', go: () => onManage('People') },
  ];
  return (
    <View>
      <Text style={st.hiLine}>Hi{leader && !leader.startsWith('acct:') ? ' Rabbi Zevy' : ''}. What do you want to share?</Text>

      {alertOn || popupOn ? (
        <View style={st.liveBox}>
          <Text style={st.liveBoxHead}>Live now</Text>
          {alertOn ? (
            <View style={st.liveRow}>
              <View style={[st.liveDot, { backgroundColor: '#E8364F' }]} />
              <Text style={st.liveRowText} numberOfLines={1}>Banner: {alertOn.title}</Text>
              <Pressable disabled={busy === 'alert'} onPress={async () => { setBusy('alert'); await sendAlert(null); setBusy(null); }} hitSlop={8} accessibilityRole="button"><Text style={st.turnOff}>{busy === 'alert' ? '…' : 'Turn off'}</Text></Pressable>
            </View>
          ) : null}
          {popupOn ? (
            <View style={st.liveRow}>
              <View style={[st.liveDot, { backgroundColor: '#7C5CFC' }]} />
              <Text style={st.liveRowText} numberOfLines={1}>Pop-up: {popupOn.title || 'Poster'}</Text>
              <Pressable disabled={busy === 'popup'} onPress={async () => { setBusy('popup'); await saveContent({ ...content, popup: { ...popupOn, on: false } }); setBusy(null); }} hitSlop={8} accessibilityRole="button"><Text style={st.turnOff}>{busy === 'popup' ? '…' : 'Turn off'}</Text></Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      <Text style={st.groupHead}>Create</Text>
      <View style={st.grid}>
        {create.map((x) => (
          <Pressable key={x.k} onPress={() => (x.k === 'compose' ? onCompose() : onCreate(x.k))} style={({ pressed }) => [st.tile, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]} accessibilityRole="button" accessibilityLabel={x.title}>
            <View style={st.tileCard}>
              <IconTile icon={x.icon} color={x.color} size={40} />
              <Text style={st.tileTitle}>{x.title}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      <Text style={st.groupHead}>Manage</Text>
      <View style={st.manage}>
        {manage.map((x, i) => (
          <Pressable key={x.title} onPress={x.go} style={({ pressed }) => [st.manageRow, i > 0 && st.manageRule, pressed && { backgroundColor: C.bg }]} accessibilityRole="button">
            <Icon name={x.icon} size={19} color={C.sub} stroke={2} />
            <Text style={st.manageText}>{x.title}</Text>
            <Icon name="right" size={16} color={C.faint} stroke={2.4} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function nextDays() {
  const out: { l: string; v: string }[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    out.push({ l: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }), v: iso(d) });
  }
  return out;
}

// Three plain forms: only the fields the rabbi needs, big text, one button.
const REMINDERS: { title: string; text: string }[] = [
  { title: '30 minutes left to wrap', text: 'Sunset is close. Wrap now and snap your photo.' },
  { title: 'Last hour to wrap today', text: 'Keep your streak alive. Snap your photo before sunset.' },
  { title: "Don't forget to wrap today", text: 'One photo keeps your streak going.' },
];

function SimpleForm({ kind, onDone, link }: { kind: 'post' | 'event' | 'alert' | 'notify'; onDone: (msg: string) => void; link?: string }) {
  const { content, saveContent, sendPush, sendAlert } = useStore();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [day, setDay] = useState(iso(new Date()));
  const [time, setTime] = useState('');
  const [place, setPlace] = useState('Chabad of Great Neck');
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Snap[]>([]);
  const [linkTo, setLinkTo] = useState(link ?? '');
  const [onlyMembers, setOnlyMembers] = useState(true);
  const linkOpts = [
    { v: '', l: 'Nothing' },
    ...upcoming(content.events).map((e) => ({ v: 'event:' + e.id, l: e.title })),
    ...content.challenges.filter((c) => c.active).map((c) => ({ v: 'challenge:' + c.id, l: c.title })),
  ];
  const linkTarget = toTarget(linkTo);
  const linkedChallenge = linkTo.startsWith('challenge:') ? content.challenges.find((c) => c.id === linkTo.slice(10)) : undefined;
  const { uploadPhoto } = useStore();
  const days = nextDays();
  const go = async () => {
    if (title.trim().length < 2) return setErr(kind === 'event' ? 'Give the event a name.' : 'Write a headline first.');
    setBusy(true); setErr(null);
    let msg = '';
    if (kind === 'post') {
      const urls = await publishPhotos(photos, uploadPhoto);
      if (typeof urls === 'string') { setBusy(false); return setErr(urls); }
      const post = { id: 'p-' + Date.now().toString(36), kind: (urls.length && !text.trim() ? 'Photos' : 'News') as 'Photos' | 'News', pinned: false, title: title.trim(), body: text.trim(), eventId: linkTo.startsWith('event:') ? linkTo.slice(6) : '', challengeId: linkTo.startsWith('challenge:') ? linkTo.slice(10) : '', photos: urls, linkLabel: '', linkUrl: '', at: new Date().toISOString() };
      const e = await saveContent({ ...content, posts: [post, ...content.posts] });
      if (e) { setBusy(false); return setErr(e); }
      msg = 'Posted to the Feed. Every phone got a notification.';
    } else if (kind === 'event') {
      const ev = { id: 'e-' + Date.now().toString(36), title: title.trim(), icon: 'star', color: 'blue' as const, scope: 'gn' as const, start: day, end: day, time: time.trim(), place: place.trim(), price: '', who: '', about: text.trim(), signup: 'app' as const, url: '', payUrl: '', gender: 'all' as const, minAge: null, maxAge: null };
      const e = await saveContent({ ...content, events: [...content.events, ev] });
      if (e) { setBusy(false); return setErr(e); }
      msg = 'Event added. Every phone got a notification, and teens can sign up in the app.';
    } else if (kind === 'notify') {
      msg = await sendPush(title.trim(), text.trim(), linkTarget, undefined, linkedChallenge && onlyMembers ? 'challenge:' + linkedChallenge.id : undefined);
    } else {
      msg = await sendAlert({ title: title.trim(), text: text.trim(), target: linkTarget, hours: 24, push: notify });
    }
    setBusy(false);
    onDone(msg.trim());
  };
  const heading = kind === 'post' ? 'Post an update' : kind === 'event' ? 'Add an event' : kind === 'notify' ? (link ? 'Challenge reminder' : 'Send a notification') : 'Live banner';
  return (
    <Card style={{ padding: 20 }}>
      <Text style={st.simpleHello}>{heading}</Text>
      {kind === 'notify' ? <Text style={[T.small, { marginTop: 4 }]}>{link ? 'A nudge for the people in the challenge. Tapping it opens the challenge.' : 'Goes straight to every phone. No banner, no post.'}</Text> : kind === 'alert' ? <Text style={[T.small, { marginTop: 4 }]}>A banner at the top of the app for 24 hours. Link it to an event to promote it.</Text> : null}
      <Field label={kind === 'event' ? 'Event name' : kind === 'notify' ? 'Title' : 'Headline'} value={title} onChange={setTitle} placeholder={kind === 'event' ? 'Pizza and Torah night' : kind === 'alert' ? 'Tonight is moved to 8 PM' : kind === 'notify' ? 'See you at 7 tonight' : 'Great turnout at the Shabbaton'} />
      {kind === 'event' ? (
        <>
          <View style={{ marginTop: 16 }}>
            <Text style={u.fieldLabel}>Day</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {days.map((d) => (
                <Pressable key={d.v} onPress={() => setDay(d.v)} style={[u.chip, day === d.v && u.chipOn]} accessibilityRole="button" accessibilityState={{ selected: day === d.v }}>
                  <Text style={[u.chipText, day === d.v && u.chipTextOn]}>{d.l}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <Field label="Time" value={time} onChange={setTime} placeholder="7:00 PM" />
          <Field label="Where" value={place} onChange={setPlace} />
        </>
      ) : null}
      <Field label={kind === 'event' ? 'Details (optional)' : kind === 'alert' || kind === 'notify' ? 'More detail (optional)' : 'Message'} value={text} onChange={setText} multiline />
      {kind === 'notify' && linkedChallenge ? (
        <View style={{ marginTop: 14 }}>
          <Text style={u.fieldLabel}>Quick reminders</Text>
          <View style={u.chipsFlow}>
            {REMINDERS.map((r) => (
              <Pressable key={r.title} onPress={() => { setTitle(r.title); setText(r.text); }} style={[u.chip, title === r.title && u.chipOn]} accessibilityRole="button">
                <Text style={[u.chipText, title === r.title && u.chipTextOn]}>{r.title}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      {kind === 'alert' || kind === 'notify' || kind === 'post' ? (
        <View style={{ marginTop: 14 }}>
          <Text style={u.fieldLabel}>{kind === 'post' ? 'Tapping the post opens' : 'Links to'}</Text>
          <Chips wrap options={linkOpts.map((o) => o.l)} value={linkOpts.find((o) => o.v === linkTo)?.l ?? 'Nothing'} onChange={(l) => setLinkTo(linkOpts.find((o) => o.l === l)?.v ?? '')} />
        </View>
      ) : null}
      {kind === 'notify' && linkedChallenge ? (
        <View style={st.toggle}>
          <Text style={[T.h3, { flex: 1, fontSize: 16 }]}>Only people in {linkedChallenge.title}</Text>
          <Toggle value={onlyMembers} onChange={setOnlyMembers} label="Only people in the challenge" />
        </View>
      ) : null}
      {kind === 'post' ? <PhotoPicker photos={photos} onChange={setPhotos} /> : null}
      {kind === 'notify' ? null : kind === 'alert' ? (
        <View style={st.toggle}>
          <Text style={[T.h3, { flex: 1, fontSize: 16 }]}>Send a notification to every phone</Text>
          <Toggle value={notify} onChange={setNotify} label="Send a notification" />
        </View>
      ) : (
        <View style={st.autoNote}>
          <Icon name="bell" size={16} color={C.blueDeep} stroke={2} />
          <Text style={[T.small, { flex: 1, color: C.ink }]}>Every phone gets a notification automatically.</Text>
        </View>
      )}
      {err ? <Text style={{ color: '#C0303F', fontWeight: '700', marginTop: 12 }}>{err}</Text> : null}
      <View style={{ marginTop: 20 }}>
        <Button label={busy ? 'Sending…' : kind === 'post' ? 'Post it' : kind === 'event' ? 'Add the event' : kind === 'notify' ? (linkedChallenge && onlyMembers ? 'Send to the challenge' : 'Send to everyone') : 'Put the banner up'} disabled={busy} onPress={go} />
      </View>
    </Card>
  );
}

// Everyone who signed up for the app, newest first. The rabbi (passcode) can make anyone a leader;
// leaders open the leader panel from their own account, no passcode needed.
function PeopleView() {
  const { loadPeople, setLeaderFor, isOwner } = useStore();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [q, setQ] = useState('');
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => { loadPeople().then((r) => setPeople(r ?? [])); }, []);
  const shown = (people ?? []).filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));
  const leaders = (people ?? []).filter((p) => p.leader).length;
  return (
    <View style={{ gap: 12 }}>
      <Text style={T.small}>{people === null ? 'Loading…' : `${people.length} signed up · ${leaders} leader${leaders === 1 ? '' : 's'}`}{isOwner ? '' : '. Only Rabbi Zevy can change who is a leader.'}</Text>
      <Field label="Search" value={q} onChange={setQ} placeholder="Name" />
      {note ? <Text style={[T.small, { color: '#C0303F' }]}>{note}</Text> : null}
      <Card style={{ padding: 0 }}>
        {shown.map((p, i) => (
          <View key={p.id} style={[st.person, i > 0 && { borderTopWidth: 1, borderTopColor: C.line }]}>
            <View style={st.personAvatar}><Text style={st.personInitial}>{p.name[0]?.toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={T.h3}>{p.name}{p.leader ? '  ·  Leader' : ''}</Text>
              <Text style={T.small}>{[p.grade ? `Grade ${p.grade}` : '', p.age ? `Age ${p.age}` : '', p.gender === 'girl' ? 'Girl' : p.gender === 'boy' ? 'Boy' : '', p.via, p.created ? 'Joined ' + new Date(p.created).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''].filter(Boolean).join(' · ')}</Text>
            </View>
            {isOwner ? (
              <Toggle value={p.leader} label={`${p.name} is a leader`} onChange={async (on) => {
                setNote(null);
                const e = await setLeaderFor(p.id, on);
                if (e) return setNote(e);
                setPeople((list) => (list ?? []).map((x) => (x.id === p.id ? { ...x, leader: on } : x)));
              }} />
            ) : null}
          </View>
        ))}
        {people && shown.length === 0 ? <Text style={[T.small, { padding: 16 }]}>No one found.</Text> : null}
      </Card>
      {isOwner ? <Text style={T.small}>Turn the switch on to make someone a leader. They get the leader panel in their app (Settings → Leader panel) without the passcode.</Text> : null}
    </View>
  );
}

// Check-in photos from the last 7 days, per photo challenge. Photos load one at a time when tapped.
function PhotoReview() {
  const { content, loadPhotos, loadPhoto, setPhotoStatus, deleteComment } = useStore();
  const photoChallenges = content.challenges.filter((c) => c.photo);
  const [cid, setCid] = useState(photoChallenges[0]?.id ?? '');
  const [rows, setRows] = useState<PhotoRow[] | null>(null);
  const mark = async (key: string, status: 'checked' | 'hidden' | '') => {
    if (await setPhotoStatus(key, status)) setRows((r) => (r ?? []).map((p) => (p.key === key ? { ...p, status } : p)));
  };
  const dropComment = async (key: string, at: string) => {
    if (await deleteComment(key, at)) setRows((r) => (r ?? []).map((p) => (p.key === key ? { ...p, comments: (p.comments ?? []).filter((c) => c.at !== at) } : p)));
  };
  const [shown, setShown] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!cid) return;
    setRows(null);
    loadPhotos(cid).then((r) => setRows(r ?? []));
  }, [cid]);
  if (!photoChallenges.length) return <Text style={T.small}>No challenge uses photo check-ins. Turn on "Check in with a photo" on a challenge first.</Text>;
  const ch = photoChallenges.find((c) => c.id === cid);
  return (
    <View style={{ gap: 12 }}>
      {photoChallenges.length > 1 ? <Chips wrap options={photoChallenges.map((c) => c.title)} value={ch?.title ?? ''} onChange={(l) => setCid(photoChallenges.find((c) => c.title === l)!.id)} /> : null}
      <Text style={T.small}>Teens in the challenge see each other's photos for the day. "Looks good" adds a Checked badge; "Hide" removes the photo for everyone. Photos are deleted after 30 days.</Text>
      {rows === null ? <Text style={T.small}>Loading photos…</Text> : rows.length === 0 ? <Text style={T.small}>No photos in the last 7 days.</Text> : null}
      {(rows ?? []).map((p) => (
        <Card key={p.key} style={{ padding: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={T.h3}>{p.name}</Text>
              <Text style={T.small}>{new Date(p.at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text>
            </View>
            {!shown[p.key] ? <Button small kind="ghost" icon="camera" label="Show" onPress={async () => { const img = await loadPhoto(p.key); if (img) setShown((s) => ({ ...s, [p.key]: img })); }} /> : null}
          </View>
          {shown[p.key] ? <Image source={{ uri: 'data:image/jpeg;base64,' + shown[p.key] }} style={st.photo} resizeMode="cover" accessibilityLabel={`Check-in photo from ${p.name}`} /> : null}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <View style={{ flex: 1 }}><Button small icon="check" label={p.status === 'checked' ? 'Checked' : 'Looks good'} color={C.green} disabled={p.status === 'checked'} onPress={() => mark(p.key, 'checked')} /></View>
            <View style={{ flex: 1 }}><Button small kind="danger" label={p.status === 'hidden' ? 'Hidden (undo)' : 'Hide'} onPress={() => mark(p.key, p.status === 'hidden' ? '' : 'hidden')} /></View>
          </View>
          {(p.comments ?? []).map((c) => (
            <View key={c.at} style={st.cRow}>
              <Text style={[T.small, { flex: 1, color: C.ink }]}><Text style={{ fontWeight: '800' }}>{c.leader ? 'You' : c.name}: </Text>{c.text}</Text>
              <Pressable onPress={() => dropComment(p.key, c.at)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Delete comment"><Icon name="x" size={14} color={C.faint} stroke={2.4} /></Pressable>
            </View>
          ))}
        </Card>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  hiLine: { fontSize: 20, fontFamily: F.display, color: C.ink, letterSpacing: -0.3 },
  liveBox: { marginTop: 16, padding: 14, borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, gap: 10 },
  liveBoxHead: { fontSize: 11, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase', color: C.sub },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveRowText: { flex: 1, fontSize: 14, fontWeight: '700', color: C.ink },
  turnOff: { fontSize: 14, fontWeight: '800', color: '#C0303F' },
  groupHead: { fontSize: 13, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: C.sub, marginTop: 24, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  tile: { width: '50%', padding: 5 },
  tileCard: { padding: 14, borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, minHeight: 104, justifyContent: 'space-between' },
  tileTitle: { fontSize: 15, fontWeight: '800', color: C.ink, marginTop: 10 },
  manage: { borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  manageRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 15 },
  manageRule: { borderTopWidth: 1, borderTopColor: C.line },
  manageText: { flex: 1, fontSize: 16, fontWeight: '700', color: C.ink },
  autoNote: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, backgroundColor: C.bluePale, borderRadius: 12, padding: 12 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  personAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.bluePale, alignItems: 'center', justifyContent: 'center' },
  personInitial: { fontSize: 16, fontWeight: '900', color: C.blueDeep },
  modeRow: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 14, padding: 4, marginBottom: 12, borderWidth: 1, borderColor: C.line },
  modeBtn: { flex: 1, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  modeOn: { backgroundColor: C.inverse },
  modeText: { fontSize: 15, fontWeight: '800', color: C.ink },
  simpleHello: { fontSize: 22, fontFamily: F.display, color: C.ink },
  task: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  taskTitle: { fontSize: 18, fontWeight: '800', color: C.ink },
  taskSub: { fontSize: 14, color: C.sub, marginTop: 2 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  backText: { fontSize: 16, fontWeight: '800', color: C.blueDeep },
  cRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  photo: { width: '100%', aspectRatio: 3 / 4, borderRadius: 14, marginTop: 12, backgroundColor: C.line },
  root: { flex: 1, backgroundColor: C.bg },
  col: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20 },
  top: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line },
  note: { backgroundColor: C.inverse, color: C.onInverse, fontWeight: '700', fontSize: 14, lineHeight: 19, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12, overflow: 'hidden' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, minHeight: 44 },
  coverRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 },
  coverThumb: { width: 96, height: 64, borderRadius: 10, backgroundColor: C.line },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  itemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  signRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line, marginTop: 10 },
});
