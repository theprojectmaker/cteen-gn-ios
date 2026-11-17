import React, { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, T } from './theme';
import { EVENT_ICONS, Icon } from './icons';
import { dateLabel, todayIso, useStore, type Content, type Question, type SignupRow, type Target } from './store';
import { Button, Card, Chips, Field, IconTile, Toggle, s as u } from './ui';

// ───────── form description ─────────
type Opt = { v: string; l: string };
type Spec = { k: string; label: string; t: 'text' | 'long' | 'pick' | 'bool' | 'lines'; opts?: Opt[]; hint?: string; ph?: string; show?: (d: Draft) => boolean };
type Draft = Record<string, string | boolean>;
type Section = 'Posts' | 'Events' | 'Challenges' | 'Photos' | 'Live banner' | 'Info' | 'Sign-ups' | 'Inbox';
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
    ...notify,
  ];
  if (key === 'events') return [
    { k: 'title', label: 'Event name', t: 'text', ph: 'Mega Chanukah Party' },
    { k: 'scope', label: 'Whose event is it?', t: 'pick', opts: [{ v: 'gn', l: 'Great Neck' }, { v: 'intl', l: 'International' }] },
    { k: 'signup', label: 'How do teens register?', t: 'pick', opts: [{ v: 'app', l: 'Sign up in the app' }, { v: 'link', l: 'On a website' }] },
    { k: 'url', label: 'Registration website', t: 'text', ph: 'https://myportal.cteen.com/…', show: (d) => d.signup === 'link' },
    { k: 'payUrl', label: 'Ticket / payment link (optional)', t: 'text', ph: 'https://…', show: (d) => d.signup === 'app' },
    { k: 'start', label: 'Start date', t: 'text', ph: '2026-12-10', hint: 'Year-month-day, like 2026-12-10.' },
    { k: 'end', label: 'End date', t: 'text', ph: 'Same as start for a one-day event' },
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
    ...notify,
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
  events: { title: '', scope: 'gn', signup: 'app', url: '', payUrl: '', start: '', end: '', time: '', place: '', price: '', icon: 'star', color: 'blue', who: '', about: '', image: '', gender: 'all', minAge: '', maxAge: '', _notify: false },
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
const SECTIONS = ['Posts', 'Events', 'Challenges', 'Photos', 'Live banner', 'Info', 'Sign-ups', 'Inbox'] as const;
const DURATIONS = [{ l: '1 hour', h: 1 }, { l: 'Today', h: 12 }, { l: '3 days', h: 72 }, { l: '1 week', h: 168 }, { l: 'Until I turn it off', h: 0 }];

export function AdminPanel() {
  const insets = useSafeAreaInsets();
  const store = useStore();
  const { adminOpen, setAdminOpen, leader, content, saveContent } = store;
  const [code, setCode] = useState('');
  const [section, setSection] = useState<Section>('Posts');
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [live, setLive] = useState<Draft>({ title: '', text: '', target: '', hours: 'Today', push: true });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [signups, setSignups] = useState<{ signups: Record<string, SignupRow[]>; phones: number } | null>(null);
  const [inbox, setInbox] = useState<Question[] | null>(null);

  useEffect(() => { setEditing(null); setNote(null); setConfirmDel(false); }, [section, adminOpen]);
  useEffect(() => {
    if (!leader || !adminOpen) return;
    if (section === 'Sign-ups') { setSignups(null); store.loadSignups().then((r) => setSignups(r ?? { signups: {}, phones: 0 })); }
    if (section === 'Inbox') { setInbox(null); store.loadInbox().then((r) => setInbox(r ?? [])); }
  }, [section, leader, adminOpen]);

  if (!adminOpen) return null;

  const save = async (next: Content, done: string) => {
    setBusy(true); setNote(null);
    const err = await saveContent(next);
    setBusy(false);
    setNote(err ?? done);
    return !err;
  };
  const login = async () => {
    setBusy(true); setNote(null);
    const err = await store.leaderLogin(code.trim());
    setBusy(false); setCode(''); setNote(err);
  };

  let body: React.ReactNode;
  if (!leader) {
    body = (
      <Card>
        <IconTile icon="lock" size={48} />
        <Text style={[T.h2, { marginTop: 12 }]}>Leader sign-in</Text>
        <Text style={[T.small, { marginTop: 4 }]}>For Rabbi Zevy and chapter leaders. Enter the leader passcode to post, run challenges and send notifications.</Text>
        <Field label="Passcode" value={code} onChange={setCode} secure />
        <View style={{ marginTop: 16 }}>
          <Button label={busy ? 'Checking…' : 'Sign in'} disabled={busy || code.trim().length < 4} onPress={login} />
        </View>
      </Card>
    );
  } else if (section === 'Live banner') {
    const a = content.alert;
    const on = a.on && (!a.until || a.until > new Date().toISOString());
    body = (
      <View style={{ gap: 12 }}>
        <Card>
          <Text style={T.eyebrow}>{on ? 'Live right now' : 'No banner showing'}</Text>
          {on ? (
            <>
              <Text style={[T.h2, { marginTop: 6 }]}>{a.title}</Text>
              {a.text ? <Text style={[T.small, { marginTop: 2 }]}>{a.text}</Text> : null}
              <Text style={[T.small, { marginTop: 6 }]}>{a.until ? `Ends ${new Date(a.until).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : 'Stays up until you turn it off'}</Text>
              <View style={{ marginTop: 12, alignSelf: 'flex-start' }}>
                <Button small kind="danger" label={busy ? 'Turning off…' : 'Turn off banner'} disabled={busy} onPress={async () => { setBusy(true); setNote(await store.sendAlert(null)); setBusy(false); }} />
              </View>
            </>
          ) : <Text style={[T.small, { marginTop: 6 }]}>Send one below. It appears at the top of every screen in the app within about 30 seconds.</Text>}
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
  } else if (section === 'Sign-ups') {
    const evs = content.events.filter((e) => e.signup === 'app');
    body = (
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
                  <Text style={T.small}>{[r.grade ? `Grade ${r.grade}` : '', r.age ? `Age ${r.age}` : '', r.gender === 'girl' ? 'Girl' : r.gender === 'boy' ? 'Boy' : '', r.school || ''].filter(Boolean).join(' · ')}</Text>
                </View>
              ))}
            </Card>
          );
        }) : null}
      </View>
    );
  } else if (section === 'Photos') {
    body = <PhotoReview />;
  } else if (section === 'Inbox') {
    body = (
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
  } else {
    const cfg = LISTS[section];
    const items = content[cfg.key] as any[];
    if (editing) {
      const d = editing.draft;
      const submit = async () => {
        const p = problem(cfg.key, d);
        if (p) return setNote(p);
        const item = fromDraft(cfg.key, { ...d, id: editing.id ?? cfg.prefix + '-' + Date.now().toString(36) });
        const nextList = editing.id ? items.map((x) => (x.id === editing.id ? item : x)) : [item, ...items];
        if (!(await save({ ...content, [cfg.key]: nextList }, editing.id ? 'Saved.' : 'Live for everyone.'))) return;
        if (!editing.id && d._notify) {
          const target: Target = cfg.key === 'events' ? { type: 'event', id: item.id } : cfg.key === 'challenges' ? { type: 'challenge', id: item.id } : item.eventId ? { type: 'event', id: item.eventId } : null;
          const sent = await store.sendPush(cfg.key === 'posts' ? item.title : `New ${cfg.one}: ${item.title}`, cfg.key === 'posts' ? String(item.body).slice(0, 150) : 'Open CTeen GN to see it.', target);
          setNote('Live for everyone. ' + sent);
        }
        setEditing(null);
      };
      body = (
        <Card>
          <Text style={T.h2}>{editing.id ? `Edit ${cfg.one}` : `New ${cfg.one}`}</Text>
          <Form list={specs(cfg.key, content, !editing.id)} draft={d} set={(draft) => setEditing({ ...editing, draft })} />
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
    } else {
      body = (
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
    }
  }

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
          {leader ? <Chips options={SECTIONS} value={section} onChange={setSection} /> : null}
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 16, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
          <View style={st.col}>
            {note ? <Text style={st.note} accessibilityLiveRegion="polite">{note}</Text> : null}
            {body}
            {leader && !editing ? (
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

// Check-in photos from the last 7 days, per photo challenge. Photos load one at a time when tapped.
function PhotoReview() {
  const { content, loadPhotos, loadPhoto } = useStore();
  const photoChallenges = content.challenges.filter((c) => c.photo);
  const [cid, setCid] = useState(photoChallenges[0]?.id ?? '');
  const [rows, setRows] = useState<{ key: string; name: string; at: string; day: string }[] | null>(null);
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
      <Text style={T.small}>Photos are deleted automatically after 30 days. Only leaders can see them.</Text>
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
        </Card>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 3 / 4, borderRadius: 14, marginTop: 12, backgroundColor: C.line },
  root: { flex: 1, backgroundColor: C.bg },
  col: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20 },
  top: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line },
  note: { backgroundColor: C.ink, color: C.white, fontWeight: '700', fontSize: 14, lineHeight: 19, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12, overflow: 'hidden' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, minHeight: 44 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  itemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  signRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line, marginTop: 10 },
});
