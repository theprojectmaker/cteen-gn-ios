import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, Platform, type ImageSourcePropType } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import SEED from '../shared/seed.json';
import { API } from './config';
import { enablePush, onNotificationTap, pushState, setReminder, type PushState } from './push';

// ───────── content model (mirrors server/functions/api/[[path]].js) ─────────
export type ColorKey = 'blue' | 'orange' | 'purple' | 'green' | 'pink' | 'yellow';
export type Target = { type: 'event' | 'challenge'; id: string } | null;
export type EventItem = {
  id: string; title: string; icon: string; color: ColorKey; image?: string; scope: 'gn' | 'intl';
  start: string; end: string; time?: string; place?: string; price?: string; who?: string; about?: string;
  signup: 'app' | 'link'; url?: string; payUrl?: string;
  gender?: 'all' | 'boys' | 'girls'; minAge?: number | null; maxAge?: number | null;
};
export type Challenge = { id: string; title: string; icon: string; color: ColorKey; every: 'day' | 'week'; goal: number; about: string; active: boolean; photo?: boolean; rewards: { at: number; prize: string }[] };
export type Post = { id: string; kind: 'News' | 'Events' | 'Photos' | 'Rewards'; pinned?: boolean; title: string; body: string; eventId?: string; challengeId?: string; photos?: string[]; linkLabel?: string; linkUrl?: string; at: string };
export type Info = { id: string; icon: string; title: string; body: string };
export type Alert = { id: string; on: boolean; title: string; text: string; target: Target; until: string };
export type Content = { alert: Alert; events: EventItem[]; challenges: Challenge[]; posts: Post[]; info: Info[] };
export type Tab = 'Home' | 'Events' | 'Feed' | 'Chapter';
const TAB_PATH = { Home: '/', Events: '/events', Feed: '/feed', Chapter: '/chapter' } as const;
export type BoardRow = { name: string; count: number };
export type Question = { id: string; name: string; text: string; at: string };
export type SignupRow = { name: string; grade: string; age?: number | null; gender?: string; at: string };
export type Gender = '' | 'boy' | 'girl';
export type Account = { id: string; token: string; google: { email: string } | null };
export type PhotoRow = { key: string; name: string; at: string; day: string };

export const CHAPTER = {
  name: 'CTeen Great Neck',
  leaders: 'Rabbi Zevy & Shani Geisinsky',
  org: 'Chabad of Great Neck',
  address: '400 East Shore Road, Great Neck, NY 11024',
  phone: '516-654-6000',
  zip: '11024',
  portal: 'https://myportal.cteen.com/',
  join: 'https://www.chabadgn.com/article.asp?aid=6581881',
  donate: 'https://www.chabadgn.com/donate',
  instagram: 'https://www.instagram.com/_cteengn/',
  instagramHandle: '@_cteengn',
  facebook: 'https://www.facebook.com/chabadgnteens/',
};

export const IMAGES: Record<string, ImageSourcePropType> = {
  islanders: require('../assets/events/islanders.png'),
  atlanta: require('../assets/events/atlanta.jpg'),
  shabbaton: require('../assets/events/shabbaton.jpg'),
};

// ───────── device-local state ─────────
type Local = {
  device: string; name: string; grade: string; age: number | null; gender: Gender;
  account: Account | null; onboarded: boolean;
  seenPosts: string[]; seenInit: boolean;
  saved: string[]; liked: string[]; going: string[]; joined: string[]; dismissed: string[];
  checks: Record<string, string[]>; // challenge id -> period keys checked in
  counts: Record<string, number>;
  reminders: Record<string, number>; // challenge id -> hour of day
};
const blank: Local = { device: '', name: '', grade: '', age: null, gender: '', account: null, onboarded: false, seenPosts: [], seenInit: false, saved: [], liked: [], going: [], joined: [], dismissed: [], checks: {}, counts: {}, reminders: {} };
const KEY = 'cteengn.v3';
const CACHE = 'cteengn.content.v3';

type Ctx = Local & {
  content: Content; online: boolean | null;
  go: (t: Tab) => void;
  refresh: () => Promise<void>;
  toggleSaved: (id: string) => void; toggleLiked: (id: string) => void;
  setProfile: (name: string, grade: string) => void;
  saveProfile: (p: { name: string; grade: string; age: number | null; gender: Gender }) => Promise<string | null>;
  finishOnboarding: () => void;
  googleReady: boolean; linkGoogle: () => Promise<string | null>; signOut: () => void;
  unreadFeed: number; markFeedSeen: () => void;
  fits: (e: EventItem) => boolean;
  activeEvent: EventItem | null; openEvent: (id: string | null) => void;
  openChallenge: (id: string | null) => void;
  openTarget: (t: Target) => void;
  liveAlert: Alert | null; dismissAlert: () => void;
  signup: (id: string, on: boolean) => Promise<string | null>;
  join: (id: string, reminderHour: number | null) => void; leave: (id: string) => void;
  checkin: (id: string, photo?: string) => Promise<{ error?: string; already?: boolean; board?: BoardRow[] }>;
  ask: (text: string) => Promise<string | null>;
  push: PushState; turnOnPush: () => Promise<void>;
  leader: string | null; adminOpen: boolean; setAdminOpen: (v: boolean) => void;
  leaderLogin: (code: string) => Promise<string | null>; leaderLogout: () => void;
  saveContent: (next: Content) => Promise<string | null>;
  sendAlert: (a: { title: string; text: string; target: Target; hours: number; push: boolean } | null) => Promise<string>;
  sendPush: (title: string, text: string, target: Target) => Promise<string>;
  loadSignups: () => Promise<{ signups: Record<string, SignupRow[]>; phones: number } | null>;
  loadInbox: () => Promise<Question[] | null>; removeQuestion: (id: string) => Promise<void>;
  loadPhotos: (challengeId: string) => Promise<PhotoRow[] | null>; loadPhoto: (key: string) => Promise<string | null>;
};

// Who is acting: the signed-in account, or the phone's own id before there is one.
const who = (me: Local) => (me.account ? { id: me.account.id, token: me.account.token } : { device: me.device, name: me.name, grade: me.grade });

const StoreCtx = createContext<Ctx>(null as unknown as Ctx);
export const useStore = () => useContext(StoreCtx);

export function tap(strong = false) {
  if (Platform.OS === 'web') return;
  (strong ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) : Haptics.selectionAsync()).catch(() => {});
}
export function open(url: string) {
  tap();
  Linking.openURL(url).catch(() => {});
}

async function api<T>(path: string, init?: { method?: string; body?: unknown; leader?: string | null }): Promise<T> {
  const res = await fetch(API + path, {
    method: init?.method ?? 'GET',
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...(init?.leader ? { Authorization: 'Bearer ' + init.leader } : {}) },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
  return data as T;
}
const msg = (e: unknown) => (e instanceof Error && !/fetch|network/i.test(e.message) ? e.message : "Can't reach CTeen GN right now. Check your connection.");
const pushNote = (p: { phones: number; sent: number } | null | undefined) => (!p ? '' : p.phones === 0 ? ' No phones have notifications turned on yet.' : ` Notification sent to ${p.sent} phone${p.sent === 1 ? '' : 's'}.`);

export async function fetchBoard(id: string) {
  return (await api<{ board: BoardRow[] }>(`/challenges/${id}/board`)).board;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [local, setLocal] = useState<Local>(blank);
  const [content, setContent] = useState<Content>(SEED as Content);
  const [online, setOnline] = useState<boolean | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [leader, setLeader] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [push, setPush] = useState<PushState>('unsupported');
  const ref = useRef(local);
  ref.current = local;

  const patch = useCallback((fn: (s: Local) => Local) => {
    setLocal((s) => {
      const next = fn(s);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);
  const keep = useCallback((c: Content) => {
    setContent(c);
    AsyncStorage.setItem(CACHE, JSON.stringify(c)).catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    try {
      keep(await api<Content>('/content'));
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, [keep]);

  const registerToken = useCallback((token: string) => api('/push/register', { method: 'POST', body: { token, device: ref.current.device } }).then(() => {}), []);

  useEffect(() => {
    (async () => {
      try {
        const [raw, cached] = await Promise.all([AsyncStorage.getItem(KEY), AsyncStorage.getItem(CACHE)]);
        const saved: Local = { ...blank, ...(raw ? JSON.parse(raw) : {}) };
        if (!saved.device) saved.device = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
        ref.current = saved;
        setLocal(saved);
        AsyncStorage.setItem(KEY, JSON.stringify(saved)).catch(() => {});
        if (cached) setContent({ ...(SEED as Content), ...JSON.parse(cached) });
      } catch {}
      refresh();
      api<{ google: boolean }>('/auth/config').then((r) => setGoogleReady(!!r.google)).catch(() => {});
      const state = await pushState();
      setPush(state);
      if (state === 'on') enablePush(registerToken); // keeps the server's token fresh
    })();
    // Live updates: re-check every 30 seconds while the app is open, and whenever it comes back to the front.
    const timer = setInterval(() => AppState.currentState === 'active' && refresh(), 30000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [refresh, registerToken]);

  // Mark everything that is there on the very first launch as already seen.
  useEffect(() => {
    if (!local.device || local.seenInit || online !== true) return;
    patch((s) => ({ ...s, seenInit: true, seenPosts: content.posts.map((p) => p.id) }));
  }, [local.device, local.seenInit, online, content.posts, patch]);

  const openTarget = useCallback((t: Target) => {
    if (!t) return;
    tap();
    if (t.type === 'event') setEventId(t.id);
    else router.push(`/challenge/${t.id}`);
  }, []);
  useEffect(() => onNotificationTap((t) => openTarget(t as Target)), [openTarget]);

  const flip = useCallback((field: 'saved' | 'liked', id: string) => {
    tap();
    patch((s) => ({ ...s, [field]: s[field].includes(id) ? s[field].filter((x) => x !== id) : [...s[field], id] }));
  }, [patch]);

  const a = content.alert;
  const liveAlert = a && a.on && a.title && !local.dismissed.includes(a.id) && (!a.until || a.until > new Date().toISOString()) ? a : null;

  const unreadFeed = local.seenInit ? content.posts.filter((p) => !local.seenPosts.includes(p.id)).length : 0;
  const saveProfile = async (p: { name: string; grade: string; age: number | null; gender: Gender }) => {
    const me = ref.current;
    ref.current = { ...me, name: p.name.trim(), grade: p.grade, age: p.age, gender: p.gender };
    patch((s) => ({ ...s, name: p.name.trim(), grade: p.grade, age: p.age, gender: p.gender }));
    try {
      const r = await api<{ account: { id: string; google: { email: string } | null }; token: string | null }>('/account', { method: 'POST', body: { ...p, id: me.account?.id, token: me.account?.token } });
      const account = { id: r.account.id, token: r.token ?? me.account!.token, google: r.account.google };
      ref.current = { ...ref.current, account };
      patch((s) => ({ ...s, account }));
      return null;
    } catch (e) {
      return msg(e);
    }
  };

  const value = useMemo<Ctx>(() => ({
    ...local, content, online, refresh, openTarget, liveAlert, push, googleReady, unreadFeed, saveProfile,
    finishOnboarding: () => patch((s) => ({ ...s, onboarded: true })),
    markFeedSeen: () => {
      if (!unreadFeed) return;
      patch((s) => ({ ...s, seenPosts: [...new Set([...s.seenPosts, ...content.posts.map((p) => p.id)])].slice(-400) }));
    },
    fits: (e) => {
      const me = ref.current;
      if (e.gender === 'boys' && me.gender === 'girl') return false;
      if (e.gender === 'girls' && me.gender === 'boy') return false;
      if (me.age != null && e.minAge != null && me.age < e.minAge) return false;
      if (me.age != null && e.maxAge != null && me.age > e.maxAge) return false;
      return true;
    },
    linkGoogle: async () => {
      // Opens Google in a secure browser sheet; the server hands back a one-time ticket.
      try {
        const WebBrowser = await import('expo-web-browser');
        const Linking2 = await import('expo-linking');
        const back = Linking2.createURL('auth');
        const res = await WebBrowser.openAuthSessionAsync(`${API}/auth/google/start?app=${encodeURIComponent(back)}`, back);
        if (res.type !== 'success') return null;
        const q = Linking2.parse(res.url).queryParams ?? {};
        if (q.error || !q.ticket) return q.error === 'cancelled' ? null : 'Google sign-in did not finish. Try again.';
        const me = ref.current;
        const r = await api<{ account: { id: string; name: string; grade: string; age: number | null; gender: Gender; google: { email: string } | null }; token: string }>('/auth/redeem', { method: 'POST', body: { ticket: q.ticket, id: me.account?.id, token: me.account?.token } });
        const account = { id: r.account.id, token: r.token, google: r.account.google };
        const next = { account, name: r.account.name || me.name, grade: r.account.grade || me.grade, age: r.account.age ?? me.age, gender: r.account.gender || me.gender, onboarded: true };
        ref.current = { ...ref.current, ...next };
        patch((s) => ({ ...s, ...next }));
        tap(true);
        return null;
      } catch (e) {
        return msg(e);
      }
    },
    signOut: () => {
      ref.current = { ...ref.current, account: null };
      patch((s) => ({ ...s, account: null }));
    },
    go: (t) => { tap(); router.navigate(TAB_PATH[t]); },
    toggleSaved: (id) => flip('saved', id),
    toggleLiked: (id) => flip('liked', id),
    setProfile: (name, grade) => {
      const me = ref.current;
      saveProfile({ name, grade, age: me.age, gender: me.gender }); // ref is updated first, so an action fired right after sees it
    },
    activeEvent: content.events.find((e) => e.id === eventId) ?? null,
    openEvent: (id) => { tap(); setEventId(id); },
    openChallenge: (id) => { if (id) { tap(); router.push(`/challenge/${id}`); } },
    dismissAlert: () => patch((s) => ({ ...s, dismissed: [...s.dismissed.slice(-20), a.id] })),
    signup: async (id, on) => {
      const me = ref.current;
      try {
        await api(`/events/${id}/${on ? 'signup' : 'cancel'}`, { method: 'POST', body: who(me) });
        patch((s) => ({ ...s, going: on ? [...new Set([...s.going, id])] : s.going.filter((x) => x !== id) }));
        if (on) tap(true);
        return null;
      } catch (e) {
        return msg(e);
      }
    },
    join: (id, hour) => {
      const ch = content.challenges.find((c) => c.id === id);
      tap(true);
      patch((s) => {
        const reminders = { ...s.reminders };
        if (hour === null) delete reminders[id];
        else reminders[id] = hour;
        return { ...s, joined: [...new Set([...s.joined, id])], reminders };
      });
      if (ch) {
        if (hour !== null) enablePush(registerToken).then(setPush);
        setReminder(id, ch.title, ch.every, hour);
      }
    },
    leave: (id) => {
      patch((s) => ({ ...s, joined: s.joined.filter((x) => x !== id) }));
      setReminder(id, '', 'day', null);
    },
    checkin: async (id, photo) => {
      const me = ref.current;
      try {
        const r = await api<{ already: boolean; count: number; period: string; board: BoardRow[] }>(`/challenges/${id}/checkin`, { method: 'POST', body: { ...who(me), photo } });
        patch((s) => ({ ...s, counts: { ...s.counts, [id]: r.count }, checks: { ...s.checks, [id]: [...new Set([...(s.checks[id] ?? []), r.period])] } }));
        if (!r.already) tap(true);
        return { already: r.already, board: r.board };
      } catch (e) {
        return { error: msg(e) };
      }
    },
    ask: async (text) => {
      const me = ref.current;
      try {
        await api('/ask', { method: 'POST', body: { name: me.name, text, device: me.device } });
        tap(true);
        return null;
      } catch (e) {
        return msg(e);
      }
    },
    turnOnPush: async () => setPush(await enablePush(registerToken)),
    leader, adminOpen, setAdminOpen,
    leaderLogin: async (code) => {
      try {
        await api('/admin/check', { method: 'POST', body: {}, leader: code });
        setLeader(code);
        return null;
      } catch (e) {
        return msg(e);
      }
    },
    leaderLogout: () => { setLeader(null); setAdminOpen(false); },
    saveContent: async (next) => {
      try {
        keep(await api<Content>('/admin/content', { method: 'PUT', body: next, leader }));
        tap(true);
        return null;
      } catch (e) {
        return msg(e);
      }
    },
    sendAlert: async (alert) => {
      try {
        const r = await api<{ content: Content; push: { phones: number; sent: number } | null }>('/admin/alert', { method: 'POST', body: alert ?? { clear: true }, leader });
        keep(r.content);
        tap(true);
        return alert ? 'Banner is live for everyone.' + pushNote(r.push) : 'Banner turned off.';
      } catch (e) {
        return msg(e);
      }
    },
    sendPush: async (title, text, target) => {
      try {
        const r = await api<{ push: { phones: number; sent: number } }>('/admin/push', { method: 'POST', body: { title, text, target }, leader });
        return pushNote(r.push).trim();
      } catch (e) {
        return msg(e);
      }
    },
    loadSignups: () => api<{ signups: Record<string, SignupRow[]>; phones: number }>('/admin/signups', { leader }).catch(() => null),
    loadInbox: () => api<{ inbox: Question[] }>('/admin/inbox', { leader }).then((r) => r.inbox).catch(() => null),
    removeQuestion: (id) => api('/admin/inbox/remove', { method: 'POST', body: { id }, leader }).then(() => {}).catch(() => {}),
    loadPhotos: (cid) => api<{ photos: PhotoRow[] }>(`/admin/photos?challenge=${cid}`, { leader }).then((r) => r.photos).catch(() => null),
    loadPhoto: (key) => api<{ photo: string }>(`/admin/photo?key=${encodeURIComponent(key)}`, { leader }).then((r) => r.photo).catch(() => null),
  }), [local, content, online, eventId, leader, adminOpen, push, liveAlert, googleReady, unreadFeed, flip, patch, refresh, keep, openTarget, registerToken]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

// ───────── dates ─────────
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function todayIso() {
  return iso(new Date());
}
export function dateLabel(e: { start: string; end: string }) {
  const a = day(e.start), b = day(e.end);
  const left = `${MONTHS[a.getMonth()]} ${a.getDate()}`;
  if (e.start === e.end) return `${left}, ${a.getFullYear()}`;
  const right = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear() ? `${b.getDate()}` : `${MONTHS[b.getMonth()]} ${b.getDate()}`;
  return `${left} – ${right}, ${b.getFullYear()}`;
}
export function daysUntil(start: string) {
  const n = new Date();
  return Math.round((day(start).getTime() - new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime()) / 86400000);
}
export function countdown(e: EventItem) {
  const n = daysUntil(e.start);
  if (n > 1) return `In ${n} days`;
  if (n === 1) return 'Tomorrow';
  if (n === 0) return 'Today';
  return daysUntil(e.end) >= 0 ? 'Happening now' : 'Past';
}
export function upcoming(events: EventItem[]) {
  return events.filter((e) => daysUntil(e.end) >= 0).sort((a, b) => a.start.localeCompare(b.start));
}
export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}
export function calendarUrl(e: EventItem) {
  const fmt = (s: string, plus = 0) => {
    const d = day(s);
    d.setDate(d.getDate() + plus);
    return iso(d).replace(/-/g, '');
  };
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(e.title + ' · CTeen Great Neck')}&dates=${fmt(e.start)}/${fmt(e.end, 1)}${e.place ? '&location=' + encodeURIComponent(e.place) : ''}`;
}
export function hourLabel(h: number) {
  return `${((h + 11) % 12) + 1}:00 ${h < 12 ? 'AM' : 'PM'}`;
}

// ───────── challenge math ─────────
export function periodKey(every: 'day' | 'week', d = new Date()) {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (every === 'week') t.setDate(t.getDate() - t.getDay());
  return iso(t);
}
export function doneThisPeriod(ch: Challenge, checks: Record<string, string[]>) {
  return (checks[ch.id] ?? []).includes(periodKey(ch.every));
}
// Periods in a row, ending now. Daily streaks skip Saturday (Shabbat).
export function streak(ch: Challenge, checks: Record<string, string[]>) {
  const have = new Set(checks[ch.id] ?? []);
  const step = ch.every === 'week' ? 7 : 1;
  const cur = day(periodKey(ch.every));
  let n = 0;
  for (let i = 0; i < 400; i++) {
    if (have.has(iso(cur))) n++;
    else if (ch.every === 'day' && cur.getDay() === 6) {
      // Shabbat never breaks a streak
    } else if (i > 0) break;
    cur.setDate(cur.getDate() - step);
  }
  return n;
}

// ───────── Shabbat times for Great Neck (Hebcal, live) ─────────
export type Shabbat = { candles?: string; havdalah?: string; parsha?: string };
export function useShabbat() {
  const [data, setData] = useState<Shabbat | null | 'error'>(null);
  useEffect(() => {
    let alive = true;
    fetch(`https://www.hebcal.com/shabbat?cfg=json&zip=${CHAPTER.zip}&M=on`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        const items: { category: string; title: string; date: string }[] = j.items ?? [];
        const time = (cat: string) => {
          const m = /T(\d{2}):(\d{2})/.exec(items.find((i) => i.category === cat)?.date ?? '');
          if (!m) return undefined;
          const h = Number(m[1]);
          return `${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
        };
        setData({ candles: time('candles'), havdalah: time('havdalah'), parsha: items.find((i) => i.category === 'parashat')?.title.replace(/^Parashat /, '') });
      })
      .catch(() => alive && setData('error'));
    return () => {
      alive = false;
    };
  }, []);
  return data;
}
