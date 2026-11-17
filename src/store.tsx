import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, Platform, type ImageSourcePropType } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import SEED from '../shared/seed.json';
import { API } from './config';
import { PREFS } from './theme';
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
export type Challenge = { id: string; title: string; icon: string; color: ColorKey; every: 'day' | 'week'; goal: number; about: string; active: boolean; photo?: boolean; starts?: string; rewards: { at: number; prize: string }[] };
export type Post = { id: string; kind: 'News' | 'Events' | 'Photos' | 'Rewards'; pinned?: boolean; title: string; body: string; eventId?: string; challengeId?: string; photos?: string[]; linkLabel?: string; linkUrl?: string; at: string };
export type Info = { id: string; icon: string; title: string; body: string };
export type Alert = { id: string; on: boolean; title: string; text: string; target: Target; until: string };
export type Popup = { on: boolean; id: string; title: string; body: string; button: string; target: { type: 'event' | 'challenge' | 'post'; id: string } | null };
export type MinyanRow = { label: string; time: string };
export type Minyan = { weekday: MinyanRow[]; shabbat: MinyanRow[]; note: string };
export type PostComment = { name: string; text: string; at: string };
export type Content = { alert: Alert; events: EventItem[]; challenges: Challenge[]; posts: Post[]; info: Info[]; popup?: Popup; minyan?: Minyan };
export const sortPosts = (posts: Post[]) => [...posts].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.at.localeCompare(a.at));
export type Tab = 'Home' | 'Events' | 'Feed' | 'Chapter';
const TAB_PATH = { Home: '/', Events: '/events', Feed: '/feed', Chapter: '/chapter' } as const;
export type BoardRow = { name: string; count: number };
export type Question = { id: string; name: string; text: string; at: string };
export type SignupRow = { name: string; grade: string; age?: number | null; gender?: string; school?: string; at: string };
export type Gender = '' | 'boy' | 'girl';
export type Profile = { name: string; grade: string; age: number | null; gender: Gender; school: string };
export type Account = { id: string; token: string; google: { email: string } | null; apple?: boolean };
export type WallComment = { name: string; text: string; at: string; leader?: boolean };
export type Person = { id: string; name: string; grade: string; age: number | null; gender: string; created: string; via: string; leader: boolean };
export type PhotoRow = { key: string; name: string; at: string; day: string; status?: string; comments?: WallComment[] };
export type Reaction = { emoji: string; count: number; mine: boolean };
export type WallPost = { key: string; name: string; at: string; status: string; mine: boolean; comments: WallComment[]; url: string; caption?: string; reactions?: Reaction[] };
export type WallWaiting = { name: string; out: boolean; mine: boolean };
export type ChallengeStats = { count: number; streak: number; strikes: number; out: boolean; goal: number; done: boolean };
export type Wall = { posts: WallPost[]; waiting: WallWaiting[]; members: number; me: ChallengeStats | null };

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
  device: string; name: string; grade: string; age: number | null; gender: Gender; school: string;
  account: Account | null; onboarded: boolean;
  seenPosts: string[]; seenInit: boolean; seenEvents: string[]; tipSeen: boolean;
  saved: string[]; liked: string[]; going: string[]; joined: string[]; dismissed: string[];
  checks: Record<string, string[]>; // challenge id -> period keys checked in
  counts: Record<string, number>;
  reminders: Record<string, number>; // challenge id -> hour of day
};
const blank: Local = { device: '', name: '', grade: '', age: null, gender: '', school: '', account: null, onboarded: false, seenPosts: [], seenInit: false, seenEvents: [], tipSeen: false, saved: [], liked: [], going: [], joined: [], dismissed: [], checks: {}, counts: {}, reminders: {} };
const KEY = 'cteengn.v3';
const CACHE = 'cteengn.content.v3';

type Ctx = Local & {
  content: Content; online: boolean | null;
  go: (t: Tab) => void;
  refresh: (force?: boolean) => Promise<void>;
  toggleSaved: (id: string) => void; toggleLiked: (id: string) => void;
  setProfile: (name: string, grade: string) => void;
  saveProfile: (p: Partial<Profile>) => Promise<string | null>;
  finishOnboarding: () => void; restartOnboarding: () => void;
  googleReady: boolean; linkGoogle: () => Promise<string | null>; signOut: () => void;
  unreadFeed: number; markFeedSeen: () => void;
  newEvents: number; markEventsSeen: () => void; hideTip: () => void;
  appleReady: boolean; signInWithApple: () => Promise<string | null>;
  fits: (e: EventItem) => boolean;
  openEvent: (id: string | null) => void;
  openChallenge: (id: string | null) => void;
  openTarget: (t: Target) => void;
  liveAlert: Alert | null; dismissAlert: () => void;
  signup: (id: string, on: boolean) => Promise<string | null>;
  goingCount: Record<string, number>;
  postMeta: Record<string, { likes: number; comments: number }>;
  likePost: (id: string) => void;
  loadComments: (id: string) => Promise<PostComment[] | null>;
  addComment: (id: string, text: string) => Promise<PostComment[] | { error: string }>;
  deletePostComment: (id: string, at: string) => Promise<boolean>;
  join: (id: string, reminderHour: number | null) => void; leave: (id: string) => void;
  joinChallenge: (id: string, name: string, reminderHour: number | null) => Promise<string | null>;
  fetchWall: (id: string, day?: string) => Promise<Wall | { error: string }>;
  comment: (id: string, key: string, text: string) => Promise<WallComment | { error: string }>;
  setPhotoStatus: (key: string, status: 'checked' | 'hidden' | '') => Promise<boolean>;
  deleteComment: (key: string, at: string) => Promise<boolean>;
  react: (id: string, key: string, emoji: string) => Promise<Reaction[] | null>;
  checkin: (id: string, photo?: string, caption?: string) => Promise<{ error?: string; already?: boolean; count?: number; board?: BoardRow[] }>;
  ask: (text: string) => Promise<string | null>;
  push: PushState; turnOnPush: () => Promise<void>;
  leader: string | null; isOwner: boolean; adminOpen: boolean; setAdminOpen: (v: boolean) => void;
  loadPeople: () => Promise<Person[] | null>; setLeaderFor: (id: string, on: boolean) => Promise<string | null>;
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
  if (Platform.OS === 'web' || !PREFS.haptics) return;
  (strong ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) : Haptics.selectionAsync()).catch(() => {});
}
export function open(url: string) {
  tap();
  Linking.openURL(url).catch(() => {});
}

async function api<T>(path: string, init?: { method?: string; body?: unknown; leader?: string | null }): Promise<T> {
  const res = await fetch(API + path, {
    method: init?.method ?? 'GET',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      // A leader is either the passcode (the rabbi) or "acct:<id>:<token>" for an account the rabbi made a leader.
      ...(init?.leader ? (init.leader.startsWith('acct:') ? { 'X-Account': init.leader.slice(5) } : { Authorization: 'Bearer ' + init.leader }) : {}),
    },
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
  const [googleReady, setGoogleReady] = useState(false);
  const [appleReady, setAppleReady] = useState(false);
  const [leader, setLeader] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [push, setPush] = useState<PushState>('unsupported');
  const [goingCount, setGoingCount] = useState<Record<string, number>>({});
  const [postMeta, setPostMeta] = useState<Record<string, { likes: number; comments: number }>>({});
  const lastRefresh = useRef(0);
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

  const refresh = useCallback(async (force?: boolean) => {
    if (!force && Date.now() - lastRefresh.current < 20000) return;
    lastRefresh.current = Date.now();
    try {
      keep(await api<Content>('/content'));
      setOnline(true);
      api<{ counts: Record<string, number> }>('/events/counts').then((r) => setGoingCount(r.counts || {})).catch(() => {});
      api<{ meta: Record<string, { likes: number; comments: number }> }>('/posts/meta').then((r) => setPostMeta(r.meta || {})).catch(() => {});
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
      if (Platform.OS === 'ios') import('expo-apple-authentication').then((A) => A.isAvailableAsync()).then(setAppleReady).catch(() => {});
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
    patch((s) => ({ ...s, seenInit: true, seenPosts: content.posts.map((p) => p.id), seenEvents: content.events.map((e) => e.id) }));
  }, [local.device, local.seenInit, online, content.posts, patch]);

  // If the rabbi made this account a leader, open the leader panel without a passcode.
  useEffect(() => {
    const acc = local.account;
    if (!acc || (leader && !leader.startsWith('acct:'))) return;
    const key = `acct:${acc.id}:${acc.token}`;
    api<{ owner: boolean }>('/admin/check', { method: 'POST', body: {}, leader: key })
      .then(() => { setLeader(key); setIsOwner(false); })
      .catch(() => { if (leader === key) setLeader(null); });
  }, [local.account?.id, local.account?.token]);

  const openTarget = useCallback((t: Target) => {
    if (!t) return;
    tap();
    if (t.type === 'event') router.push(`/event/${t.id}`);
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
  const fitsNow = (e: EventItem) => {
    if (e.gender === 'boys' && local.gender === 'girl') return false;
    if (e.gender === 'girls' && local.gender === 'boy') return false;
    if (local.age != null && e.minAge != null && local.age < e.minAge) return false;
    if (local.age != null && e.maxAge != null && local.age > e.maxAge) return false;
    return true;
  };
  const newEvents = local.seenInit ? upcoming(content.events).filter(fitsNow).filter((e) => !local.seenEvents.includes(e.id)).length : 0;
  const saveProfile = async (part: Partial<Profile>) => {
    const me = ref.current;
    const p: Profile = { name: (part.name ?? me.name).trim(), grade: part.grade ?? me.grade, age: part.age !== undefined ? part.age : me.age, gender: part.gender ?? me.gender, school: part.school ?? me.school };
    ref.current = { ...me, ...p };
    patch((s) => ({ ...s, ...p }));
    if (p.name.length < 2) return null; // nothing to save on the server until there is a name
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

  const value: Ctx = useMemo<Ctx>(() => ({
    ...local, content, online, refresh, openTarget, liveAlert, push, googleReady, unreadFeed, saveProfile, newEvents, appleReady,
    markEventsSeen: () => {
      if (!newEvents) return;
      patch((s) => ({ ...s, seenEvents: [...new Set([...s.seenEvents, ...content.events.map((e) => e.id)])].slice(-300) }));
    },
    hideTip: () => patch((s) => ({ ...s, tipSeen: true })),
    signInWithApple: async () => {
      try {
        const A = await import('expo-apple-authentication');
        const cred = await A.signInAsync({ requestedScopes: [A.AppleAuthenticationScope.FULL_NAME] });
        if (!cred.identityToken) return 'Apple sign-in did not finish. Try again.';
        // Apple shares the name only the very first time; keep it as "First L."
        const given = cred.fullName?.givenName?.trim() ?? '';
        const family = cred.fullName?.familyName?.trim() ?? '';
        const name = given ? `${given}${family ? ' ' + family[0].toUpperCase() + '.' : ''}` : '';
        const me = ref.current;
        const r = await api<{ account: { id: string; name: string; grade: string; age: number | null; gender: Gender; school?: string; google: { email: string } | null; apple?: boolean }; token: string }>('/auth/apple', { method: 'POST', body: { identityToken: cred.identityToken, name, id: me.account?.id, token: me.account?.token } });
        const account = { id: r.account.id, token: r.token, google: r.account.google, apple: true };
        const next = { account, name: r.account.name || name || me.name, grade: r.account.grade || me.grade, age: r.account.age ?? me.age, gender: r.account.gender || me.gender };
        ref.current = { ...ref.current, ...next };
        patch((s) => ({ ...s, ...next }));
        tap(true);
        return null;
      } catch (e: any) {
        if (e?.code === 'ERR_REQUEST_CANCELED') return null;
        return msg(e);
      }
    },
    finishOnboarding: () => patch((s) => ({ ...s, onboarded: true })),
    restartOnboarding: () => patch((s) => ({ ...s, onboarded: false })),
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
        const r = await api<{ account: { id: string; name: string; grade: string; age: number | null; gender: Gender; school?: string; google: { email: string } | null }; token: string }>('/auth/redeem', { method: 'POST', body: { ticket: q.ticket, id: me.account?.id, token: me.account?.token } });
        const account = { id: r.account.id, token: r.token, google: r.account.google };
        const next = { account, name: r.account.name || me.name, grade: r.account.grade || me.grade, age: r.account.age ?? me.age, gender: r.account.gender || me.gender, school: r.account.school || me.school, onboarded: true };
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
    postMeta,
    likePost: (id) => {
      const me = ref.current;
      const on = !me.liked.includes(id);
      flip('liked', id);
      setPostMeta((m) => ({ ...m, [id]: { likes: Math.max(0, (m[id]?.likes ?? 0) + (on ? 1 : -1)), comments: m[id]?.comments ?? 0 } }));
      api<{ likes: number }>(`/posts/${id}/like`, { method: 'POST', body: { ...who(me), on } })
        .then((r) => setPostMeta((m) => ({ ...m, [id]: { likes: r.likes, comments: m[id]?.comments ?? 0 } })))
        .catch(() => {});
    },
    loadComments: async (id) => {
      try { return (await api<{ comments: PostComment[] }>(`/posts/${id}/comments`)).comments; } catch { return null; }
    },
    addComment: async (id, text) => {
      try {
        const r = await api<{ comments: PostComment[] }>(`/posts/${id}/comment`, { method: 'POST', body: { ...who(ref.current), text } });
        setPostMeta((m) => ({ ...m, [id]: { likes: m[id]?.likes ?? 0, comments: r.comments.length } }));
        return r.comments;
      } catch (e) { return { error: msg(e) }; }
    },
    deletePostComment: async (id, at) => {
      try {
        await api(`/admin/post-comment-delete`, { method: 'POST', body: { post: id, at }, leader });
        setPostMeta((m) => ({ ...m, [id]: { likes: m[id]?.likes ?? 0, comments: Math.max(0, (m[id]?.comments ?? 1) - 1) } }));
        return true;
      } catch { return false; }
    },
    setProfile: (name, grade) => {
      const me = ref.current;
      saveProfile({ name, grade }); // ref is updated first, so an action fired right after sees it
    },
    openEvent: (id) => { if (id) { tap(); router.push(`/event/${id}`); } },
    openChallenge: (id) => { if (id) { tap(); router.push(`/challenge/${id}`); } },
    dismissAlert: () => patch((s) => ({ ...s, dismissed: [...s.dismissed.slice(-20), a.id] })),
    goingCount,
    signup: async (id, on) => {
      const me = ref.current;
      try {
        const r = await api<{ count: number }>(`/events/${id}/${on ? 'signup' : 'cancel'}`, { method: 'POST', body: who(me) });
        if (typeof r.count === 'number') setGoingCount((c) => ({ ...c, [id]: r.count }));
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
    joinChallenge: async (id, name, hour) => {
      // Make sure there is an account first: the photo wall is for signed-up members only.
      if (!ref.current.account || ref.current.name !== name.trim()) {
        const e = await saveProfile({ name });
        if (e) return e;
      }
      try {
        await api(`/challenges/${id}/join`, { method: 'POST', body: who(ref.current) });
      } catch (e) {
        return msg(e);
      }
      value.join(id, hour);
      return null;
    },
    fetchWall: async (id, day) => {
      const me = ref.current;
      if (!me.account) return { error: 'Join the challenge to see the photos.' };
      try {
        const q = `id=${encodeURIComponent(me.account.id)}&token=${encodeURIComponent(me.account.token)}${day ? '&day=' + day : ''}`;
        const w = await api<Wall>(`/challenges/${id}/wall?${q}`);
        return { ...w, waiting: w.waiting ?? [], me: w.me ?? null };
      } catch (e) {
        return { error: msg(e) };
      }
    },
    comment: async (id, key, text) => {
      try {
        const r = await api<{ comment: WallComment }>(`/challenges/${id}/comment`, { method: 'POST', body: { ...who(ref.current), key, text } });
        tap();
        return r.comment;
      } catch (e) {
        return { error: msg(e) };
      }
    },
    setPhotoStatus: (key, status) => api('/admin/photo-status', { method: 'POST', body: { key, status }, leader }).then(() => true).catch(() => false),
    deleteComment: (key, at) => api('/admin/comment-delete', { method: 'POST', body: { key, at }, leader }).then(() => true).catch(() => false),
    leave: (id) => {
      patch((s) => ({ ...s, joined: s.joined.filter((x) => x !== id) }));
      setReminder(id, '', 'day', null);
    },
    react: (id, key, emoji) => api<{ reactions: Reaction[] }>(`/challenges/${id}/react`, { method: 'POST', body: { ...who(ref.current), key, emoji } }).then((r) => { tap(); return r.reactions; }).catch(() => null),
    checkin: async (id, photo, caption) => {
      const me = ref.current;
      try {
        const r = await api<{ already: boolean; count: number; period: string; board: BoardRow[] }>(`/challenges/${id}/checkin`, { method: 'POST', body: { ...who(me), photo, caption } });
        patch((s) => ({ ...s, counts: { ...s.counts, [id]: r.count }, checks: { ...s.checks, [id]: [...new Set([...(s.checks[id] ?? []), r.period])] } }));
        if (!r.already) tap(true);
        return { already: r.already, count: r.count, board: r.board };
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
    leader, isOwner, adminOpen, setAdminOpen,
    loadPeople: () => api<{ people: Person[]; owner: boolean }>('/admin/people', { leader }).then((r) => { setIsOwner(r.owner); return r.people; }).catch(() => null),
    setLeaderFor: async (id, on) => {
      try {
        await api('/admin/leaders', { method: 'POST', body: { id, on }, leader });
        tap(true);
        return null;
      } catch (e) {
        return msg(e);
      }
    },
    leaderLogin: async (code) => {
      try {
        const r = await api<{ owner: boolean }>('/admin/check', { method: 'POST', body: {}, leader: code });
        setLeader(code);
        setIsOwner(!!r.owner);
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
  }), [local, content, online, leader, isOwner, adminOpen, push, liveAlert, googleReady, appleReady, unreadFeed, newEvents, goingCount, postMeta, flip, patch, refresh, keep, openTarget, registerToken]);

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
export type Shabbat = { candles?: string; havdalah?: string; parsha?: string; candlesAt?: number; havdalahAt?: number };
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
        const at = (cat: string) => { const d = items.find((i) => i.category === cat)?.date; return d ? new Date(d).getTime() : undefined; };
        setData({ candles: time('candles'), havdalah: time('havdalah'), parsha: items.find((i) => i.category === 'parashat')?.title.replace(/^Parashat /, ''), candlesAt: at('candles'), havdalahAt: at('havdalah') });
      })
      .catch(() => alive && setData('error'));
    return () => {
      alive = false;
    };
  }, []);
  return data;
}
