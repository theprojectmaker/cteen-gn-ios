// CTeen GN backend (Cloudflare Pages Function + KV binding CTEEN).
//
// Public
//   GET  /api/content                      live banner, events, challenges, posts, info
//   POST /api/account                      create or update a profile { id?, token?, name, grade, age, gender }
//   GET  /api/auth/config                  { google: true|false }
//   GET  /api/auth/google/start?app=...    begins "Link with Google" (redirects to Google)
//   GET  /api/auth/google/callback         Google returns here; redirects back to the app with a ticket
//   POST /api/auth/redeem                  { ticket, id?, token? } -> links Google to the account, or signs in
//   POST /api/auth/apple                   { identityToken, name?, id?, token? } -> Sign in with Apple
//   POST /api/events/:id/signup|cancel     { id, token } (or legacy { device, name, grade })
//   GET  /api/events/counts                how many are going to each in-app event (no names)
//   GET  /api/posts/meta                   likes + comment counts per post (cached 10s at the edge)
//   POST /api/posts/:id/like               { id, token, on } like / unlike a Feed post
//   GET  /api/posts/:id/comments           comments on a post
//   POST /api/posts/:id/comment            { id, token, text }
//   POST /api/admin/post-comment-delete    { post, at }
//   POST /api/admin/media                  { photo } (base64 JPEG) -> { url } for Feed photos
//   GET  /api/media/:id                    a Feed photo
//   POST /api/admin/ai-draft               { text } WhatsApp text -> { title, body, kind, event }
//   POST /api/admin/minyan-from-text       { text } AI reads a pasted schedule and returns updated minyan times (not saved)
//   POST /api/challenges/:id/checkin       { id, token, photo? } one per day or week; photo is a small JPEG (base64)
//   GET  /api/challenges/:id/board         top names + counts
//   POST /api/challenges/:id/join          { id, token } join (needed to see the photo wall)
//   GET  /api/challenges/:id/wall?day=     { id, token } members see that day's photos, names, times, comments
//   POST /api/challenges/:id/comment       { id, token, key, text }
//   POST /api/challenges/:id/react         { id, token, key, emoji } toggles your reaction on a photo
//   GET  /api/photo?key=&exp=&sig=         one photo as a JPEG (signed link from the wall, valid 1 hour)
//   POST /api/push/register                { token, device }
//   POST /api/push/prefs                   { device, photos } photo alerts on/off (on unless turned off)
//   POST /api/admin/push-me                { device } this leader phone gets a notification for every comment
//   POST /api/admin/ai-event               { prompt, info, keep } AI drafts an event (keep = use the details as given)
//   POST /api/invites/:id/respond          { id, token, answer: 'yes' | 'no' } answer a personal invitation
//   GET  /api/admin/invite-responses       who said yes / no to each invitation
//   GET  /api/broadcasts                   everything sent to everyone, newest first (the Inbox in Settings)
//   POST /api/ask                          { name, text, device } question for the rabbi
// Leaders: Authorization: Bearer <passcode> (the rabbi, "owner"), or X-Account: <id>:<token> for an
// account the rabbi made a leader. New events and Feed posts notify every phone automatically.
//   GET  /api/admin/people                 everyone who signed up for the app
//   POST /api/admin/leaders                { id, on } owner only: make someone a leader or not
//   POST /api/admin/check, PUT /api/admin/content, POST /api/admin/alert, POST /api/admin/push
//   GET  /api/admin/signups, GET /api/admin/inbox, POST /api/admin/inbox/remove
//   GET  /api/admin/photos?challenge=ID    check-in photos from the last 7 days (newest first)
//   GET  /api/admin/photo?key=KEY          one photo
//   POST /api/admin/photo-status           { key, status: 'checked' | 'hidden' | '' }
//   POST /api/admin/comment-delete         { key, at }
import SEED from '../../../shared/seed.json';
import MANAGED from '../../../shared/managed.json';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Account',
  'Access-Control-Max-Age': '86400',
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS } });
const bad = (msg, status = 400) => json({ error: msg }, status);
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, max);
const idOk = (v) => typeof v === 'string' && /^[a-z0-9-]{1,40}$/.test(v);
const newId = (p) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const randomToken = () => [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, '0')).join('');
const PHOTO_TTL = 60 * 60 * 24 * 30; // check-in photos are deleted after 30 days

function nyDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(now); // YYYY-MM-DD
}
// Sunrise and sunset in Great Neck (NOAA sunrise equation, same as src/zmanim.ts in the app).
function sunTimes(ymd) {
  const rad = Math.PI / 180, LAT = 40.8007, LON = -73.7285;
  const [y, m, d] = ymd.split('-').map(Number);
  const n = Math.ceil(Date.UTC(y, m - 1, d) / 86400000 + 2440587.5 - 2451545 + 0.0008);
  const js = n - LON / 360;
  const M = (357.5291 + 0.98560028 * js) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const L = (M + C + 180 + 102.9372) % 360;
  const transit = 2451545 + js + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * L * rad);
  const dec = Math.asin(Math.sin(L * rad) * Math.sin(23.4397 * rad));
  const w = Math.acos((Math.sin(-0.833 * rad) - Math.sin(LAT * rad) * Math.sin(dec)) / (Math.cos(LAT * rad) * Math.cos(dec))) / rad;
  const ms = (j) => Math.round((j - 2440587.5) * 86400000);
  return { rise: ms(transit - w / 360), set: ms(transit + w / 360) };
}
const nyClock = (ms) => new Date(ms).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
// Returns an error message when tefillin can't be wrapped right now, or '' when it can.
function wrapClosed(now = Date.now()) {
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(new Date(now));
  if (day === 'Sat') return 'No tefillin on Shabbat. See you Sunday.';
  const { rise, set: sunset } = sunTimes(nyDate(new Date(now)));
  const set = day === 'Fri' ? sunset - 18 * 60000 : sunset; // Fridays: before candle lighting
  if (now < rise) return `Tefillin opens at sunrise, ${nyClock(rise)}.`;
  if (now > set) return `Today's window closed at ${day === 'Fri' ? 'candle lighting' : 'sunset'} (${nyClock(set)}). Come back tomorrow from ${nyClock(sunTimes(nyDate(new Date(now + 864e5))).rise)}.`;
  return '';
}

function periodKey(every) {
  const d = nyDate();
  if (every !== 'week') return d;
  const [y, m, day] = d.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, day));
  t.setUTCDate(t.getUTCDate() - t.getUTCDay()); // back to Sunday
  return t.toISOString().slice(0, 10);
}

async function sha(s) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function sameSecret(a, b) {
  const [x, y] = await Promise.all([sha(a), sha(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

// Leader auth: the passcode (owner) or a leader account; per-IP lockout after 6 wrong passcodes.
async function isLeader(request, env) {
  const xa = request.headers.get('X-Account') || '';
  if (xa && !request.headers.get('Authorization')) {
    const [id, token] = xa.split(':');
    const acc = await getAccount(env, id, token);
    const admins = (await env.CTEEN.get('admins', 'json')) || {};
    if (acc && admins[acc.id]) return { ok: true, owner: false, name: acc.name, id: acc.id };
    return { ok: false, status: 401, msg: 'You are not a leader.' };
  }
  if (!env.ADMIN_PASSCODE) return { ok: false, status: 503, msg: 'Leader passcode is not set up on the server.' };
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const lockKey = 'lock:' + ip;
  const misses = Number((await env.CTEEN.get(lockKey)) || 0);
  if (misses >= 6) return { ok: false, status: 429, msg: 'Too many wrong tries. Wait 15 minutes.' };
  const given = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (given && (await sameSecret(given, env.ADMIN_PASSCODE))) return { ok: true, owner: true, name: 'Rabbi Zevy' };
  await env.CTEEN.put(lockKey, String(misses + 1), { expirationTtl: 900 });
  return { ok: false, status: 401, msg: 'Wrong passcode.' };
}

// ───────── accounts ─────────
// account:<id> = { id, tokenHash, name, grade, age, gender, google?: { sub, email }, created }
// google:<sub> = <id>
const GENDERS = ['boy', 'girl', ''];
async function getAccount(env, id, token) {
  if (!idOk(id) || typeof token !== 'string' || token.length < 20) return null;
  const acc = await env.CTEEN.get('account:' + id, 'json');
  if (!acc || !(await sameSecret(await sha(token), acc.tokenHash))) return null;
  return acc;
}
const publicAccount = (a) => ({ id: a.id, name: a.name, grade: a.grade, age: a.age, gender: a.gender, school: a.school || '', apple: !!a.apple, google: a.google ? { email: a.google.email } : null });
function profileFields(b) {
  const age = Number(b.age);
  return {
    name: clean(b.name, 40),
    grade: clean(b.grade, 4),
    age: Number.isFinite(age) && age >= 10 && age <= 25 ? Math.round(age) : null,
    gender: GENDERS.includes(b.gender) ? b.gender : '',
    school: clean(b.school, 40),
  };
}

// Who is acting: a signed-in account, or (older app versions) a bare device id.
async function actor(env, b) {
  if (b.id && b.token) {
    const acc = await getAccount(env, b.id, b.token);
    if (!acc) return { error: 'Please sign in again.' };
    return { key: acc.id, name: acc.name, grade: acc.grade, age: acc.age, gender: acc.gender, school: acc.school || '' };
  }
  const device = clean(b.device, 40);
  if (device.length < 8) return { error: 'Bad request.' };
  return { key: device, name: clean(b.name, 40), grade: clean(b.grade, 12), age: null, gender: '', school: '' };
}

// Signed, short-lived photo links so <Image> can load a photo without a login header.
async function hmac(secret, msg) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg)))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function photoUrl(env, origin, key) {
  const exp = String(Date.now() + 3600 * 1000);
  return `${origin}/api/photo?key=${encodeURIComponent(key)}&exp=${exp}&sig=${await hmac(env.ADMIN_PASSCODE || 'cteen', key + '|' + exp)}`;
}
const PHOTO_KEY = /^photo:([a-z0-9-]+):(\d{4}-\d{2}-\d{2}):([A-Za-z0-9-]+)$/;
const recentDay = (d) => { for (let i = 0; i < 8; i++) if (nyDate(new Date(Date.now() - i * 86400000)) === d) return true; return false; };
// The list entry for one photo lives in photos:<challenge>:<day>.
async function editPhotoEntry(env, key, fn) {
  const m = PHOTO_KEY.exec(key);
  if (!m) return false;
  const listKey = `photos:${m[1]}:${m[2]}`;
  const list = (await env.CTEEN.get(listKey, 'json')) || [];
  const i = list.findIndex((p) => p.key === key);
  if (i < 0) return false;
  const res = fn(list[i]);
  if (res === false) return false;
  await env.CTEEN.put(listKey, JSON.stringify(list), { expirationTtl: PHOTO_TTL });
  return true;
}

// ───────── challenge rules ─────────
// Each missed day (Shabbat never counts) is a strike and resets the streak.
// Strike 2 also adds one extra day to your goal. Strike 3 and you're out of the challenge.
const STRIKES_OUT = 3;
function periodsBetween(every, fromIso, toIso) {
  // periods strictly after fromIso up to and including toIso (YYYY-MM-DD, NY dates)
  const out = [];
  const step = every === 'week' ? 7 : 1;
  const d = new Date(fromIso + 'T12:00:00Z');
  const end = new Date(toIso + 'T12:00:00Z');
  if (every === 'week') d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  d.setUTCDate(d.getUTCDate() + step);
  while (d <= end && out.length < 400) {
    if (!(every === 'day' && d.getUTCDay() === 6)) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + step);
  }
  return out;
}
function memberStats(ch, row, joinedAt) {
  const days = new Set((row && row.days) || (row && row.last ? [row.last] : []));
  const today = periodKey(ch.every);
  const joined = joinedAt ? nyDate(new Date(joinedAt)) : today;
  // nothing before the challenge's start day can count as a miss
  const start = ch.starts && ch.starts > joined ? ch.starts : joined;
  // the period before today is the last one that can be missed
  const yesterday = new Date(today + 'T12:00:00Z');
  yesterday.setUTCDate(yesterday.getUTCDate() - (ch.every === 'week' ? 7 : 1));
  const missed = periodsBetween(ch.every, start, yesterday.toISOString().slice(0, 10)).filter((p) => !days.has(p));
  const strikes = Math.min(missed.length, STRIKES_OUT);
  // streak: periods in a row, back from today (or yesterday if today isn't done yet)
  let streak = 0;
  const cur = new Date(today + 'T12:00:00Z');
  if (!days.has(today)) cur.setUTCDate(cur.getUTCDate() - (ch.every === 'week' ? 7 : 1));
  for (let i = 0; i < 400; i++) {
    const k = cur.toISOString().slice(0, 10);
    if (ch.every === 'day' && cur.getUTCDay() === 6) { cur.setUTCDate(cur.getUTCDate() - 1); continue; }
    if (!days.has(k)) break;
    streak++;
    cur.setUTCDate(cur.getUTCDate() - (ch.every === 'week' ? 7 : 1));
  }
  return { count: (row && row.count) || 0, streak, strikes, out: strikes >= STRIKES_OUT, goal: ch.goal + (strikes >= 2 ? 1 : 0), done: days.has(today) };
}

const managedIds = (k) => new Set(((MANAGED && MANAGED[k]) || []).map((x) => x.id));
function withManaged(c) {
  const ev = (MANAGED && MANAGED.events) || [], ch = (MANAGED && MANAGED.challenges) || [];
  if (!ev.length && !ch.length) return c;
  const evIds = managedIds('events'), chIds = managedIds('challenges');
  return {
    ...c,
    events: [...ev.map((e) => ({ ...e, managed: true })), ...(c.events || []).filter((e) => !evIds.has(e.id))],
    challenges: [...ch.map((x) => ({ ...x, managed: true })), ...(c.challenges || []).filter((x) => !chIds.has(x.id))],
  };
}
function withoutManaged(c) {
  const evIds = managedIds('events'), chIds = managedIds('challenges');
  return { ...c, events: (c.events || []).filter((e) => !evIds.has(e.id)), challenges: (c.challenges || []).filter((x) => !chIds.has(x.id)) };
}

async function getContent(env) {
  const c = withManaged({ ...((await env.CTEEN.get('content', 'json')) || SEED) });
  if (!c.minyan) c.minyan = MINYAN_DEFAULT;
  if (!c.popup) c.popup = { on: false, id: '', title: '', body: '', button: '', target: null };
  if (c.alert && c.alert.on && c.alert.until && c.alert.until < new Date().toISOString()) c.alert = { ...c.alert, on: false };
  return c;
}

const KINDS = ['News', 'Events', 'Photos', 'Rewards', 'Food'];
const COLORS = ['blue', 'orange', 'purple', 'green', 'pink', 'yellow'];
const dateOk = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const urlOk = (v) => typeof v === 'string' && /^(https:\/\/|mailto:|tel:)/.test(v) && v.length < 400;
const targetOk = (t) => (t && ['event', 'challenge', 'post'].includes(t.type) && idOk(t.id) ? { type: t.type, id: t.id } : null);
const ageOk = (v) => { const n = Number(v); return v !== '' && v != null && Number.isFinite(n) && n >= 10 && n <= 25 ? Math.round(n) : null; };

// Rebuild the document field by field so nothing unexpected is ever stored.
const MINYAN_DEFAULT = {
  weekday: [
    { label: 'Shacharit, Sunday', time: '7:30 AM & 9:00 AM' },
    { label: 'Shacharit, Monday to Friday', time: '7:00 AM & 9:00 AM' },
    { label: 'Mincha & Maariv', time: '' },
  ],
  shabbat: [
    { label: 'Teen Minyan', time: '10:00 AM' },
    { label: 'Friday night', time: 'Candle lighting' },
    { label: 'Shabbat morning', time: '9:25 AM' },
    { label: 'Mincha', time: '' },
    { label: 'Maariv', time: '10 min after Shabbat ends' },
  ],
  note: 'A short 5 to 7 minute class follows the morning minyan. Shabbat morning has a junior congregation and Kiddush after services.',
};

function sanitize(doc, alert) {
  const list = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
  const color = (c) => (COLORS.includes(c) ? c : 'blue');
  return {
    alert,
    events: list(doc.events, 60).filter((e) => idOk(e.id) && dateOk(e.start)).map((e) => ({
      id: e.id, title: clean(e.title, 80), icon: clean(e.icon, 20), color: color(e.color), image: clean(e.image, 20),
      scope: e.scope === 'intl' ? 'intl' : 'gn', start: e.start, end: dateOk(e.end) && e.end >= e.start ? e.end : e.start,
      time: clean(e.time, 40), place: clean(e.place, 120), price: clean(e.price, 40), who: clean(e.who, 300), about: clean(e.about, 1200),
      signup: e.signup === 'link' ? 'link' : 'app', url: urlOk(e.url) ? e.url : '', payUrl: urlOk(e.payUrl) ? e.payUrl : '',
      gender: ['boys', 'girls'].includes(e.gender) ? e.gender : 'all', minAge: ageOk(e.minAge), maxAge: ageOk(e.maxAge),
      poster: typeof e.poster === 'string' && /^https:\/\/\S{4,400}$/.test(e.poster) ? e.poster : '', showGoing: !!e.showGoing,
    })),
    challenges: list(doc.challenges, 20).filter((c) => idOk(c.id)).map((c) => ({
      id: c.id, title: clean(c.title, 60), icon: clean(c.icon, 20), color: color(c.color), every: c.every === 'week' ? 'week' : 'day',
      goal: Math.min(366, Math.max(1, Number(c.goal) || 1)), about: clean(c.about, 400), active: c.active !== false, photo: !!c.photo,
      starts: /^\d{4}-\d{2}-\d{2}$/.test(c.starts || '') ? c.starts : '',
      rules: list(c.rules, 12).map((r) => clean(r, 220)).filter(Boolean),
      image: typeof c.image === 'string' && /^https:\/\/\S{4,300}$/.test(c.image) ? c.image : '',
      rewards: list(c.rewards, 8).map((r) => ({ at: Math.min(366, Math.max(1, Number(r.at) || 1)), prize: clean(r.prize, 80) })).sort((x, y) => x.at - y.at),
    })),
    posts: list(doc.posts, 200).filter((p) => idOk(p.id)).map((p) => ({
      id: p.id, kind: KINDS.includes(p.kind) ? p.kind : 'News', pinned: !!p.pinned, title: clean(p.title, 120), body: clean(p.body, 1500),
      eventId: idOk(p.eventId) ? p.eventId : '', challengeId: idOk(p.challengeId) ? p.challengeId : '',
      photos: list(p.photos, 10).filter(urlOk), linkLabel: clean(p.linkLabel, 60), linkUrl: urlOk(p.linkUrl) ? p.linkUrl : '', at: dateOk(p.at) ? p.at : nyDate(),
    })),
    info: list(doc.info, 30).filter((i) => idOk(i.id)).map((i) => ({ id: i.id, icon: clean(i.icon, 20), title: clean(i.title, 60), body: clean(i.body, 600) })),
    popup: doc.popup && typeof doc.popup === 'object' ? {
      on: !!doc.popup.on, id: clean(doc.popup.id, 40) || 'p' + Date.now().toString(36),
      title: clean(doc.popup.title, 80), body: clean(doc.popup.body, 600), button: clean(doc.popup.button, 30),
      image: typeof doc.popup.image === 'string' && /^https:\/\/\S{4,400}$/.test(doc.popup.image) ? doc.popup.image : '', more: clean(doc.popup.more, 800),
      target: doc.popup.target && ['event', 'challenge', 'post'].includes(doc.popup.target.type) && idOk(doc.popup.target.id) ? { type: doc.popup.target.type, id: doc.popup.target.id } : null,
    } : { on: false, id: '', title: '', body: '', button: '', target: null },
    invites: list(doc.invites, 20).filter((v) => idOk(v.id)).map((v) => ({
      id: v.id, on: v.on !== false, title: clean(v.title, 80), message: clean(v.message, 600), details: clean(v.details, 2000),
      eventId: idOk(v.eventId) ? v.eventId : '', image: typeof v.image === 'string' && /^https:\/\/\S{4,400}$/.test(v.image) ? v.image : '',
      audience: ['boys', 'girls'].includes(v.audience) ? v.audience : 'all', until: dateOk(v.until) ? v.until : '', remind: v.remind !== false,
      at: typeof v.at === 'string' ? clean(v.at, 30) : new Date().toISOString(),
    })),
    minyan: doc.minyan && typeof doc.minyan === 'object' ? {
      weekday: list(doc.minyan.weekday, 12).map((r) => ({ label: clean(r.label, 50), time: clean(r.time, 40) })).filter((r) => r.label),
      shabbat: list(doc.minyan.shabbat, 12).map((r) => ({ label: clean(r.label, 50), time: clean(r.time, 40) })).filter((r) => r.label),
      note: clean(doc.minyan.note, 300),
    } : MINYAN_DEFAULT,
  };
}

// "Jonathan took his tefillin photo today" to every phone except the poster and anyone who turned it off.
async function pushPhotoAlert(env, title, body, data, exceptDevice) {
  const all = (await env.CTEEN.get('push', 'json')) || {};
  const off = (await env.CTEEN.get('pushoff:photos', 'json')) || {};
  const tokens = Object.entries(all).filter(([d]) => d !== exceptDevice && !off[d]).map(([, tok]) => tok);
  for (let i = 0; i < tokens.length; i += 100) {
    const batch = tokens.slice(i, i + 100).map((to) => ({ to, title, body, sound: 'default', data: data || {} }));
    await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(batch) }).catch(() => null);
  }
}

// Leader phones (registered with /api/admin/push-me) hear about every comment.
async function pushLeaders(env, title, body, data, exceptDevice) {
  const all = (await env.CTEEN.get('push', 'json')) || {};
  const leaders = (await env.CTEEN.get('pushadmins', 'json')) || {};
  const tokens = Object.keys(leaders).filter((d) => d !== exceptDevice && all[d]).map((d) => all[d]);
  if (!tokens.length) return;
  await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(tokens.map((to) => ({ to, title, body, sound: 'default', data: data || {} }))) }).catch(() => null);
}

// The Inbox: notifications, live banners, pop-ups and new posts/events, newest first (last 100).
async function logBroadcast(env, kind, title, text, target) {
  const list = (await env.CTEEN.get('broadcasts', 'json')) || [];
  list.unshift({ id: newId('b'), kind, title: clean(title, 120), text: clean(text, 300), target: target || null, at: new Date().toISOString() });
  await env.CTEEN.put('broadcasts', JSON.stringify(list.slice(0, 100)));
}

async function pushAll(env, title, body, data, image) {
  const tokens = Object.values((await env.CTEEN.get('push', 'json')) || {});
  let sent = 0;
  for (let i = 0; i < tokens.length; i += 100) {
    const batch = tokens.slice(i, i + 100).map((to) => ({ to, title, body, sound: 'default', data: { ...(data || {}), image: image || undefined }, ...(image ? { richContent: { image }, mutableContent: true } : {}) }));
    const res = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(batch) }).catch(() => null);
    if (res && res.ok) sent += batch.length;
  }
  return { phones: tokens.length, sent };
}

// ───────── Sign in with Apple ─────────
const APPLE_AUD = 'com.solyapps.cteengn';
const b64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
// Checks the token Apple gave the phone: Apple's signature, our app, not expired. Returns its claims or null.
async function verifyApple(env, jwt) {
  const parts = String(jwt || '').split('.');
  if (parts.length !== 3) return null;
  let header, claims;
  try { header = JSON.parse(new TextDecoder().decode(b64url(parts[0]))); claims = JSON.parse(new TextDecoder().decode(b64url(parts[1]))); } catch { return null; }
  let keys = await env.CTEEN.get('apple:jwks', 'json');
  if (!keys || !keys.find((k) => k.kid === header.kid)) {
    const r = await fetch('https://appleid.apple.com/auth/keys').then((x) => x.json()).catch(() => null);
    if (!r || !r.keys) return null;
    keys = r.keys;
    await env.CTEEN.put('apple:jwks', JSON.stringify(keys), { expirationTtl: 86400 });
  }
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk || header.alg !== 'RS256') return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!ok || claims.iss !== 'https://appleid.apple.com' || claims.aud !== APPLE_AUD || !(claims.exp * 1000 > Date.now()) || !claims.sub) return null;
  return claims;
}

// Only app links of this app may receive a sign-in ticket.
const APP_RETURN = /^(cteengn:\/\/|exp:\/\/|exps:\/\/|https?:\/\/localhost(:\d+)?\/)/;

// ── AI (Groq first, Cloudflare Workers AI as a fallback). Returns parsed JSON or null. ──
async function aiJson(env, system, user) {
  const parse = (s) => { try { const m = String(s || '').match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; } catch { return null; } };
  if (env.GROQ_API_KEY) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.GROQ_API_KEY },
        body: JSON.stringify({ model: 'openai/gpt-oss-120b', temperature: 0.2, reasoning_format: 'hidden', reasoning_effort: 'low', response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
      });
      if (r.ok) { const j = await r.json(); const out = parse(j.choices?.[0]?.message?.content); if (out) return out; }
    } catch {}
  }
  if (env.AI) {
    try {
      const r = await env.AI.run('@cf/openai/gpt-oss-120b', { instructions: system, input: user });
      const text = (r.output || []).flatMap((o) => o.content || []).map((c) => c.text || '').join('');
      const out = parse(text || r.response);
      if (out) return out;
    } catch {}
  }
  return null;
}

const TIME_OK = /^(\d{1,2}:\d{2}\s*(AM|PM)(\s*(&|and|,)\s*\d{1,2}:\d{2}\s*(AM|PM))*|Candle lighting|\d+ min after Shabbat ends)$/i;
// Reads a schedule the rabbi pasted and fills in rows it clearly states. Never invents, never blanks.
async function minyanFromText(env, cur, text) {
  const out = await aiJson(env,
    'You update a synagogue minyan schedule from a message the rabbi pasted. Reply with JSON only: {"weekday":[{"label","time"}],"shabbat":[{"label","time"}]}. Keep the same rows and labels you are given. Change a row ONLY if the message clearly gives its time. Never invent a time. Rows the message does not mention keep their current value exactly (even if empty). Times look like "7:00 AM" or "7:00 AM & 9:00 AM"; keep "Candle lighting" and "N min after Shabbat ends" as words.',
    `Today is ${nyDate()}.\nCurrent schedule: ${JSON.stringify(cur)}\nThe rabbi's message:\n${text}`);
  if (!out) return null;
  const merge = (rows, next) => rows.map((r) => {
    const n = (next || []).find((x) => x && x.label === r.label);
    const time = n && typeof n.time === 'string' ? n.time.trim() : '';
    return time && TIME_OK.test(time) ? { label: r.label, time } : r;
  });
  return { weekday: merge(cur.weekday, out.weekday), shabbat: merge(cur.shabbat, out.shabbat), note: cur.note };
}

// Short edge cache for GETs every phone makes on every open, so lots of users barely touch storage.
async function edgeCached(request, seconds, make) {
  let cache = null;
  try { cache = caches.default; } catch {}
  const key = new Request(new URL(request.url).toString(), { method: 'GET' });
  if (cache) { const hit = await cache.match(key); if (hit) return hit; }
  const res = await make();
  if (!cache || res.status !== 200) return res;
  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', `public, max-age=0, s-maxage=${seconds}`);
  await cache.put(key, out.clone());
  return out;
}

export async function onRequest({ request, env, params, waitUntil }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (!env.CTEEN) return bad('Storage is not connected.', 503);
  const url = new URL(request.url);
  const path = (params.path || []).join('/');
  const method = request.method;
  const body = method === 'POST' || method === 'PUT' ? await request.json().catch(() => null) : null;
  if ((method === 'POST' || method === 'PUT') && !body) return bad('Bad request.');

  try {
    if (path === 'content' && method === 'GET') {
      return edgeCached(request, 10, async () => {
        const c = await getContent(env);
        return json(c);
      });
    }
    let mm = /^media\/([a-z0-9]{6,40})$/.exec(path);
    if (mm && method === 'GET') {
      const data = await env.CTEEN.get('media:' + mm[1]);
      if (!data) return bad('Not found.', 404);
      const bin = Uint8Array.from(atob(data), (ch) => ch.charCodeAt(0));
      return new Response(bin, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable', ...CORS } });
    }

    // ── feed posts: likes and comments ──
    if (path === 'posts/meta' && method === 'GET') {
      return edgeCached(request, 10, async () => {
        const content = await getContent(env);
        const ids = content.posts.slice(0, 60).map((p) => p.id);
        const rows = await Promise.all(ids.map((id) => env.CTEEN.get('pm:' + id, 'json')));
        const meta = {};
        ids.forEach((id, i) => { const r = rows[i] || {}; meta[id] = { likes: (r.likes || []).length, comments: (r.comments || []).length }; });
        return json({ meta });
      });
    }
    let pm = /^posts\/([a-z0-9-]+)\/(like|comments|comment)$/.exec(path);
    if (pm) {
      const [, pid, action] = pm;
      const key = 'pm:' + pid;
      const row = (await env.CTEEN.get(key, 'json')) || { likes: [], comments: [] };
      if (action === 'comments' && method === 'GET') return json({ comments: (row.comments || []).map((c) => ({ name: c.name, text: c.text, at: c.at })) });
      if (method !== 'POST') return bad('Not found.', 404);
      const content = await getContent(env);
      if (!content.posts.some((p) => p.id === pid)) return bad('That post was removed.', 404);
      const who = await actor(env, body);
      if (who.error) return bad(who.error, 401);
      if (action === 'like') {
        const likes = (row.likes || []).filter((k) => k !== who.key);
        if (body.on !== false) likes.push(who.key);
        row.likes = likes.slice(-5000);
        await env.CTEEN.put(key, JSON.stringify(row));
        return json({ ok: true, likes: row.likes.length, liked: body.on !== false });
      }
      if (action === 'comment') {
        if (who.name.length < 2) return bad('Add your name first.');
        const text = clean(body.text, 300);
        if (!text) return bad('Write something first.');
        row.comments = [...(row.comments || []), { name: who.name, who: who.key, text, at: new Date().toISOString() }].slice(-300);
        await env.CTEEN.put(key, JSON.stringify(row));
        const postTitle = (content.posts.find((p) => p.id === pid) || {}).title || 'a post';
        try { waitUntil(pushLeaders(env, `${who.name} commented on "${postTitle.slice(0, 40)}"`, text, { target: { type: 'post', id: pid } }, clean(body.device, 40))); } catch {}
        return json({ ok: true, comments: row.comments.map((c) => ({ name: c.name, text: c.text, at: c.at })) });
      }
    }

    // ── accounts ──
    if (path === 'account' && method === 'POST') {
      const fields = profileFields(body);
      if (fields.name.length < 2) return bad('Add your name.');
      let acc = body.id ? await getAccount(env, body.id, body.token) : null;
      let token = null;
      if (!acc) {
        token = randomToken();
        acc = { id: newId('u'), tokenHash: await sha(token), created: new Date().toISOString() };
      }
      acc = { ...acc, ...fields };
      await env.CTEEN.put('account:' + acc.id, JSON.stringify(acc));
      return json({ account: publicAccount(acc), token });
    }

    // Your app data (challenges, check-ins, RSVPs, saved, liked, invitation answers) saved on your
    // account, so signing in with Apple on a new phone brings it all back. { id, token, state? }
    if (path === 'account/state' && method === 'POST') {
      const acc = await getAccount(env, body.id, body.token);
      if (!acc) return bad('Please sign in again.', 401);
      const key = 'state:' + acc.id;
      if (body.state && typeof body.state === 'object') {
        const text = JSON.stringify(body.state);
        if (text.length > 60000) return bad('Too much to save.', 413);
        await env.CTEEN.put(key, text);
        return json({ ok: true });
      }
      return json({ state: (await env.CTEEN.get(key, 'json')) || null });
    }

    if (path === 'auth/config' && method === 'GET') return json({ google: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) });

    if (path === 'auth/google/start' && method === 'GET') {
      if (!env.GOOGLE_CLIENT_ID) return bad('Google sign-in is not set up yet.', 503);
      const back = url.searchParams.get('app') || '';
      if (!APP_RETURN.test(back)) return bad('Bad return address.');
      const state = randomToken();
      await env.CTEEN.put('oauth:' + state, back, { expirationTtl: 600 });
      const g = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      g.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
      g.searchParams.set('redirect_uri', url.origin + '/api/auth/google/callback');
      g.searchParams.set('response_type', 'code');
      g.searchParams.set('scope', 'openid email profile');
      g.searchParams.set('state', state);
      g.searchParams.set('prompt', 'select_account');
      return Response.redirect(g.toString(), 302);
    }

    if (path === 'auth/google/callback' && method === 'GET') {
      const state = url.searchParams.get('state') || '';
      const back = state && (await env.CTEEN.get('oauth:' + state));
      if (!back) return new Response('This sign-in link expired. Go back to the app and try again.', { status: 400 });
      await env.CTEEN.delete('oauth:' + state);
      const code = url.searchParams.get('code');
      const sep = back.includes('?') ? '&' : '?';
      if (!code) return Response.redirect(back + sep + 'error=cancelled', 302);
      const tok = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: url.origin + '/api/auth/google/callback', grant_type: 'authorization_code' }),
      }).then((r) => r.json()).catch(() => ({}));
      // The ID token came straight from Google over TLS, so its claims can be read without re-verifying the signature.
      let claims = null;
      try { claims = JSON.parse(atob(tok.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch { /* bad token */ }
      if (!claims || !claims.sub || claims.aud !== env.GOOGLE_CLIENT_ID) return Response.redirect(back + sep + 'error=google', 302);
      const ticket = randomToken();
      await env.CTEEN.put('ticket:' + ticket, JSON.stringify({ sub: claims.sub, email: clean(claims.email, 120), name: clean(claims.given_name || claims.name, 40) }), { expirationTtl: 300 });
      return Response.redirect(back + sep + 'ticket=' + ticket, 302);
    }

    if (path === 'auth/redeem' && method === 'POST') {
      const t = clean(body.ticket, 80);
      const g = t && (await env.CTEEN.get('ticket:' + t, 'json'));
      if (!g) return bad('That sign-in expired. Try again.');
      await env.CTEEN.delete('ticket:' + t);
      const existingId = await env.CTEEN.get('google:' + g.sub);
      const current = body.id ? await getAccount(env, body.id, body.token) : null;
      let acc;
      if (existingId) {
        // This Google account already belongs to a CTeen GN account: sign in to that one on this phone.
        acc = await env.CTEEN.get('account:' + existingId, 'json');
      } else {
        acc = current || { id: newId('u'), created: new Date().toISOString(), name: g.name, grade: '', age: null, gender: '' };
        acc.google = { sub: g.sub, email: g.email };
        await env.CTEEN.put('google:' + g.sub, acc.id);
      }
      if (!acc) return bad('Account not found.', 404);
      const token = randomToken();
      acc.tokenHash = await sha(token); // a fresh key for this phone
      await env.CTEEN.put('account:' + acc.id, JSON.stringify(acc));
      return json({ account: publicAccount(acc), token });
    }

    if (path === 'auth/apple' && method === 'POST') {
      const claims = await verifyApple(env, body.identityToken);
      if (!claims) return bad('Apple sign-in did not work. Try again.', 401);
      const existingId = await env.CTEEN.get('apple:' + claims.sub);
      const current = body.id ? await getAccount(env, body.id, body.token) : null;
      let acc;
      if (existingId) acc = await env.CTEEN.get('account:' + existingId, 'json');
      if (!acc) {
        acc = current || { id: newId('u'), created: new Date().toISOString(), name: clean(body.name, 40), grade: '', age: null, gender: '' };
        if (!acc.name && body.name) acc.name = clean(body.name, 40);
        acc.apple = { sub: claims.sub };
        await env.CTEEN.put('apple:' + claims.sub, acc.id);
      }
      const token = randomToken();
      acc.tokenHash = await sha(token);
      await env.CTEEN.put('account:' + acc.id, JSON.stringify(acc));
      return json({ account: { ...publicAccount(acc), apple: true }, token });
    }

    // ── events ──
    // How many are going to each in-app event (numbers only; names stay leader-only).
    if (path === 'events/counts' && method === 'GET') return edgeCached(request, 10, async () => {
      const content = await getContent(env);
      const counts = {};
      const evs = content.events.filter((x) => x.signup === 'app');
      const rows = await Promise.all(evs.map((e) => env.CTEEN.get('signups:' + e.id, 'json')));
      const names = {};
      evs.forEach((e, i) => {
        if (!e.showGoing) return; // private unless the rabbi turns on "Show who's going"
        const list = rows[i] || [];
        counts[e.id] = list.length;
        names[e.id] = list.slice(-30).map((r) => String(r.name || '').split(' ')[0]).filter(Boolean);
      });
      return json({ counts, names });
    });
    // An event as a calendar file (Apple Calendar opens it with "Add to Calendar").
    let im = /^events\/([a-z0-9-]+)\/ics$/.exec(path);
    if (im && method === 'GET') {
      const ev = (await getContent(env)).events.find((e) => e.id === im[1]);
      if (!ev) return bad('Not found.', 404);
      const esc = (s) => String(s || '').replace(/([\\;,])/g, '\\$1').replace(/\n/g, '\\n');
      const d = (s) => s.replace(/-/g, '');
      const next = (s) => { const x = new Date(s + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10).replace(/-/g, ''); };
      const tm = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i.exec(ev.time || '');
      let when;
      if (tm) {
        const h = (Number(tm[1]) % 12) + (/pm/i.test(tm[3]) ? 12 : 0);
        const mi = tm[2] || '00';
        const hh = String(h).padStart(2, '0'), endH = String(Math.min(23, h + 2)).padStart(2, '0');
        when = 'DTSTART;TZID=America/New_York:' + d(ev.start) + 'T' + hh + mi + '00\r\nDTEND;TZID=America/New_York:' + d(ev.end || ev.start) + 'T' + endH + mi + '00';
      } else {
        when = 'DTSTART;VALUE=DATE:' + d(ev.start) + '\r\nDTEND;VALUE=DATE:' + next(ev.end || ev.start);
      }
      const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CTeen GN//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
        'UID:' + ev.id + '@cteen-gn', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z', when,
        'SUMMARY:' + esc(ev.title + ' (CTeen Great Neck)'), ev.place ? 'LOCATION:' + esc(ev.place) : '', ev.about ? 'DESCRIPTION:' + esc(ev.about) : '',
        'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
      return new Response(ics, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="' + ev.id + '.ics"', ...CORS } });
    }
    let m = /^events\/([a-z0-9-]+)\/(signup|cancel)$/.exec(path);
    if (m && method === 'POST') {
      const [, id, action] = m;
      const content = await getContent(env);
      const ev = content.events.find((e) => e.id === id);
      if (!ev || ev.signup !== 'app') return bad('This event does not take sign-ups in the app.', 404);
      const who = await actor(env, body);
      if (who.error) return bad(who.error, 401);
      const key = 'signups:' + id;
      const rows = ((await env.CTEEN.get(key, 'json')) || []).filter((r) => r.device !== who.key);
      if (action === 'signup') {
        if (who.name.length < 2) return bad('Add your name.');
        if (rows.length >= 500) return bad('This event is full.', 409);
        rows.push({ name: who.name, grade: who.grade, age: who.age, gender: who.gender, school: who.school, device: who.key, at: new Date().toISOString() });
      }
      await env.CTEEN.put(key, JSON.stringify(rows));
      return json({ ok: true, going: action === 'signup', count: rows.length });
    }

    // ── challenges ──
    m = /^challenges\/([a-z0-9-]+)\/(join|wall|comment|react)$/.exec(path);
    if (m) {
      const [, id, action] = m;
      const content = await getContent(env);
      if (!content.challenges.find((c) => c.id === id)) return bad('Challenge not found.', 404);
      const leader = request.headers.get('Authorization') ? (await isLeader(request, env)).ok : false;
      const creds = method === 'GET' ? { id: url.searchParams.get('id'), token: url.searchParams.get('token') } : body;
      const who = leader ? { key: 'leader', name: 'Rabbi Zevy' } : await actor(env, creds || {});
      if (who.error) return bad(who.error, 401);
      const members = (await env.CTEEN.get('members:' + id, 'json')) || {};
      if (action === 'join' && method === 'POST') {
        if (who.name.length < 2) return bad('Add your name first.');
        if (!members[who.key] && Object.keys(members).length >= 1000) return bad('This challenge is full.', 409);
        members[who.key] = { name: who.name, at: members[who.key]?.at || new Date().toISOString() };
        await env.CTEEN.put('members:' + id, JSON.stringify(members));
        return json({ ok: true, members: Object.keys(members).length });
      }
      if (!leader && !members[who.key]) return bad('Join the challenge to see the photos.', 403);
      if (action === 'wall' && method === 'GET') {
        const day = url.searchParams.get('day') || nyDate();
        if (!recentDay(day)) return bad('Only the last week is kept.');
        const list = (await env.CTEEN.get(`photos:${id}:${day}`, 'json')) || [];
        const posts = [];
        for (const p of list) {
          if (p.status === 'hidden' && !leader) continue;
          const reactions = Object.entries(p.reactions || {}).map(([emoji, keys]) => ({ emoji, count: keys.length, mine: keys.includes(who.key) })).filter((r) => r.count > 0);
          posts.push({ key: p.key, name: p.name, at: p.at, status: p.status || '', mine: p.who === who.key, caption: p.caption || '', reactions, comments: (p.comments || []).map((c) => ({ name: c.name, text: c.text, at: c.at, leader: !!c.leader })), url: await photoUrl(env, url.origin, p.key) });
        }
        const board = (await env.CTEEN.get('board:' + id, 'json')) || {};
        const ch = content.challenges.find((c) => c.id === id);
        const posted = new Set(list.map((p) => p.who));
        const others = [];
        for (const [k, m] of Object.entries(members)) {
          if (posted.has(k)) continue;
          const s = memberStats(ch, board[k], m.at);
          if (m.at && nyDate(new Date(m.at)) > day) continue; // joined after that day
          others.push({ name: m.name, out: s.out, mine: k === who.key });
        }
        others.sort((a, b) => Number(a.out) - Number(b.out) || a.name.localeCompare(b.name));
        const me = who.key !== 'leader' ? memberStats(ch, board[who.key], members[who.key]?.at) : null;
        return json({ day, posts, waiting: others, members: Object.keys(members).length, me });
      }
      if (action === 'react' && method === 'POST') {
        const REACTIONS = ['❤️', '🔥', '💪', '👏', '🙌'];
        const emoji = REACTIONS.includes(body.emoji) ? body.emoji : null;
        const k = String(body.key || '');
        if (!emoji || !k.startsWith(`photo:${id}:`)) return bad('Bad request.');
        let result = null;
        const ok = await editPhotoEntry(env, k, (p) => {
          if (p.status === 'hidden') return false;
          p.reactions = p.reactions || {};
          const keys = p.reactions[emoji] || [];
          p.reactions[emoji] = keys.includes(who.key) ? keys.filter((x) => x !== who.key) : [...keys, who.key].slice(-1000);
          result = Object.entries(p.reactions).map(([e, ks]) => ({ emoji: e, count: ks.length, mine: ks.includes(who.key) })).filter((r) => r.count > 0);
        });
        return ok ? json({ ok: true, reactions: result }) : bad('That photo is gone.', 404);
      }
      if (action === 'comment' && method === 'POST') {
        const text = clean(body.text, 200);
        if (text.length < 1) return bad('Write a comment first.');
        const k = String(body.key || '');
        if (!k.startsWith(`photo:${id}:`)) return bad('Bad request.');
        const cap = 'ccount:' + who.key + ':' + nyDate();
        const n = Number((await env.CTEEN.get(cap)) || 0);
        if (n >= 40) return bad("That's a lot of comments today. Try again tomorrow.", 429);
        const comment = { name: who.name, who: who.key, text, at: new Date().toISOString(), leader: who.key === 'leader' };
        const ok = await editPhotoEntry(env, k, (p) => {
          if (p.status === 'hidden') return false;
          p.comments = (p.comments || []).slice(-59);
          p.comments.push(comment);
        });
        if (!ok) return bad('That photo is gone.', 404);
        await env.CTEEN.put(cap, String(n + 1), { expirationTtl: 90000 });
        if (!comment.leader) { try { waitUntil(pushLeaders(env, `${who.name} commented on a Tefillin photo`, text, { target: { type: 'challenge', id } }, clean(body.device, 40))); } catch {} }
        return json({ ok: true, comment: { name: comment.name, text, at: comment.at, leader: comment.leader } });
      }
    }

    if (path === 'photo' && method === 'GET') {
      const key = url.searchParams.get('key') || '', exp = url.searchParams.get('exp') || '', sig = url.searchParams.get('sig') || '';
      if (!PHOTO_KEY.test(key) || !(Number(exp) > Date.now()) || !(await sameSecret(sig, await hmac(env.ADMIN_PASSCODE || 'cteen', key + '|' + exp)))) return new Response('Link expired', { status: 403, headers: CORS });
      const data = await env.CTEEN.get(key);
      if (!data) return new Response('Gone', { status: 404, headers: CORS });
      const bin = Uint8Array.from(atob(data), (ch) => ch.charCodeAt(0));
      return new Response(bin, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=3600', ...CORS } });
    }

    m = /^challenges\/([a-z0-9-]+)\/(checkin|board)$/.exec(path);
    if (m) {
      const [, id, action] = m;
      const content = await getContent(env);
      const ch = content.challenges.find((c) => c.id === id);
      if (!ch) return bad('Challenge not found.', 404);
      const key = 'board:' + id;
      const board = (await env.CTEEN.get(key, 'json')) || {};
      const top = () => Object.values(board).sort((a, b) => b.count - a.count).slice(0, 25).map((r) => ({ name: r.name, count: r.count }));
      if (action === 'board' && method === 'GET') return json({ board: top() });
      if (action === 'checkin' && method === 'POST') {
        if (!ch.active) return bad('This challenge is closed.', 409);
        const who = await actor(env, body);
        if (who.error) return bad(who.error, 401);
        if (who.name.length < 2) return bad('Add your name first.');
        const period = periodKey(ch.every);
        const row = board[who.key] || { name: who.name, count: 0, last: '', days: [] };
        if (row.last === period) return json({ ok: true, already: true, count: row.count, period, board: top() });
        const membersNow = (await env.CTEEN.get('members:' + id, 'json')) || {};
        if (memberStats(ch, row, membersNow[who.key]?.at).out) return bad("You've missed 3 days, so you're out of this challenge. Talk to Rabbi Zevy.", 409);
        if (id === 'tefillin') { const closed = wrapClosed(); if (closed) return bad(closed, 409); }
        let photoKey = '';
        if (ch.photo) {
          const photo = typeof body.photo === 'string' ? body.photo : '';
          if (!/^[A-Za-z0-9+/=]{2000,}$/.test(photo)) return bad('Take a photo to check in.');
          if (photo.length > 700000) return bad('That photo is too big. Try again.');
          photoKey = `photo:${id}:${period}:${who.key}`;
          await env.CTEEN.put(photoKey, photo, { expirationTtl: PHOTO_TTL });
          const listKey = `photos:${id}:${period}`;
          const list = ((await env.CTEEN.get(listKey, 'json')) || []).filter((p) => p.key !== photoKey);
          list.unshift({ key: photoKey, name: who.name, who: who.key, at: new Date().toISOString(), status: '', comments: [], caption: clean(body.caption, 140), reactions: {} });
          await env.CTEEN.put(listKey, JSON.stringify(list.slice(0, 500)), { expirationTtl: PHOTO_TTL });
          const first = (who.name || 'Someone').split(' ')[0];
          const title = id === 'tefillin' ? `${first} took his tefillin photo today` : `${first} checked in to ${ch.title}`;
          const note = clean(body.caption, 140) || 'Tap to see it and cheer him on.';
          try { waitUntil(pushPhotoAlert(env, title, note, { target: { type: 'challenge', id } }, clean(body.device, 40))); } catch {}
        }
        if (!board[who.key] && Object.keys(board).length >= 1000) return bad('Leaderboard is full.', 409);
        board[who.key] = { name: who.name, count: Math.min(row.count + 1, 9999), last: period, days: [...new Set([...(row.days || (row.last ? [row.last] : [])), period])].slice(-120) };
        await env.CTEEN.put(key, JSON.stringify(board));
        const members = (await env.CTEEN.get('members:' + id, 'json')) || {};
        if (!members[who.key]) { members[who.key] = { name: who.name, at: new Date().toISOString() }; await env.CTEEN.put('members:' + id, JSON.stringify(members)); }
        return json({ ok: true, already: false, count: board[who.key].count, period, board: top() });
      }
    }

    let ivm = /^invites\/([a-z0-9-]+)\/respond$/.exec(path);
    if (ivm && method === 'POST') {
      const content = await getContent(env);
      const inv = (content.invites || []).find((v) => v.id === ivm[1]);
      if (!inv) return bad('That invitation was taken down.', 404);
      const who = await actor(env, body);
      if (who.error) return bad(who.error, 401);
      const answer = body.answer === 'no' ? 'no' : 'yes';
      const key = 'inviteans:' + inv.id;
      const rows = ((await env.CTEEN.get(key, 'json')) || []).filter((r) => r.who !== who.key);
      rows.push({ who: who.key, name: who.name, answer, at: new Date().toISOString() });
      await env.CTEEN.put(key, JSON.stringify(rows.slice(-2000)));
      return json({ ok: true, answer });
    }
    if (path === 'broadcasts' && method === 'GET') {
      return edgeCached(request, 10, async () => json({ items: (await env.CTEEN.get('broadcasts', 'json')) || [] }));
    }
    if (path === 'push/prefs' && method === 'POST') {
      const device = clean(body.device, 40);
      if (!device) return bad('Bad request.');
      const off = (await env.CTEEN.get('pushoff:photos', 'json')) || {};
      if (body.photos === false) off[device] = 1; else delete off[device];
      await env.CTEEN.put('pushoff:photos', JSON.stringify(off));
      return json({ ok: true, photos: body.photos !== false });
    }
    if (path === 'push/register' && method === 'POST') {
      const device = clean(body.device, 40), token = clean(body.token, 120);
      if (device.length < 8 || !/^Expo(nent)?PushToken\[[^\]]+\]$/.test(token)) return bad('Bad request.');
      const all = (await env.CTEEN.get('push', 'json')) || {};
      if (!all[device] && Object.keys(all).length >= 5000) return bad('Full.', 409);
      all[device] = token;
      await env.CTEEN.put('push', JSON.stringify(all));
      return json({ ok: true });
    }

    if (path === 'ask' && method === 'POST') {
      const device = clean(body.device, 40), name = clean(body.name, 40), text = clean(body.text, 600);
      if (device.length < 8 || name.length < 2) return bad('Add your name first.');
      if (text.length < 3) return bad('Write your question first.');
      const inbox = (await env.CTEEN.get('inbox', 'json')) || [];
      const today = nyDate();
      if (inbox.filter((q) => q.device === device && q.day === today).length >= 5) return bad("That's enough questions for today. Try again tomorrow.", 429);
      inbox.unshift({ id: newId('q'), name, text, device, day: today, at: new Date().toISOString() });
      await env.CTEEN.put('inbox', JSON.stringify(inbox.slice(0, 200)));
      return json({ ok: true });
    }

    // ── leaders ──
    if (path.startsWith('admin/')) {
      const auth = await isLeader(request, env);
      if (!auth.ok) return bad(auth.msg, auth.status);
      if (path === 'admin/check' && method === 'POST') return json({ ok: true, owner: !!auth.owner });
      const save = async (next) => {
        const text = JSON.stringify(next);
        if (text.length > 400000) return bad('Too much content.', 413);
        await env.CTEEN.put('content', text);
        return null;
      };
      if (path === 'admin/content' && method === 'PUT') {
        const current = await getContent(env);
        const raw = (await env.CTEEN.get('content', 'json')) || {};
        const next = sanitize(withoutManaged(body), current.alert || SEED.alert);
        const err = await save(next);
        if (err) return err;
        // Anything new gets a notification on every phone (at most 3 per save).
        const oldPosts = new Set(current.posts.map((p) => p.id)), oldEvents = new Set(current.events.map((e) => e.id));
        const when = (e) => { try { return new Date(e.start + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }); } catch { return e.start; } };
        const summary = async (p) => {
          const text = [p.title, p.body].filter(Boolean).join('. ');
          if ((p.body || '').length <= 110) return p.body || 'Open CTeen GN to see it.';
          const s = await aiJson(env, 'Summarize this chapter announcement for a phone notification. Reply with JSON only: {"summary"}. One plain sentence, max 110 characters, keep the key facts (what, when, where), no emojis, add nothing new.', text);
          return s && typeof s.summary === 'string' && s.summary.trim() ? clean(s.summary, 140) : p.body.slice(0, 120) + '…';
        };
        const newPosts = next.posts.filter((p) => !oldPosts.has(p.id));
        const fresh = [
          ...next.events.filter((e) => !oldEvents.has(e.id) && !newPosts.some((p) => p.eventId === e.id)).map((e) => ({ title: 'New event: ' + e.title, body: 'Join now. ' + [when(e), e.time, e.place].filter(Boolean).join(' · '), target: { type: 'event', id: e.id } })),
          ...(await Promise.all(newPosts.map(async (p) => ({
            title: p.kind === 'Food' ? 'On the menu: ' + p.title : p.eventId ? 'New event: ' + p.title : 'New announcement: ' + p.title,
            body: p.eventId ? 'Join now. ' + (await summary(p)) : await summary(p),
            target: p.eventId ? { type: 'event', id: p.eventId } : { type: 'post', id: p.id },
          })))),
        ].slice(0, 3);
        for (const n of fresh) { await pushAll(env, n.title, n.body, { target: n.target }); await logBroadcast(env, n.target && n.target.type === 'event' ? 'event' : 'post', n.title, n.body, n.target); }
        if (next.popup && next.popup.on && next.popup.title && (!current.popup || current.popup.id !== next.popup.id)) await logBroadcast(env, 'popup', next.popup.title, next.popup.body, next.popup.target);
        const oldInv = new Set((current.invites || []).map((v) => v.id));
        for (const v of (next.invites || []).filter((x) => x.on && !oldInv.has(x.id)).slice(0, 2)) {
          await pushAll(env, "You're invited: " + v.title, 'Rabbi Zevy sent you a personal invitation. Open CTeen GN to answer.', { target: { type: 'invite', id: v.id } }, v.image);
          await logBroadcast(env, 'event', "You're invited: " + v.title, v.message.replace(/\{name\}/g, '').slice(0, 200), null);
        }
        return json(withManaged(next));
      }
      if (path === 'admin/alert' && method === 'POST') {
        const current = await getContent(env);
        let alert = { id: '', on: false, title: '', text: '', target: null, until: '' };
        if (!body.clear) {
          const title = clean(body.title, 60), text = clean(body.text, 160);
          if (title.length < 2) return bad('Add a title.');
          const hours = Math.min(24 * 30, Math.max(0, Number(body.hours) || 0));
          alert = { id: newId('a'), on: true, title, text, target: targetOk(body.target), until: hours ? new Date(Date.now() + hours * 3600000).toISOString() : '' };
        }
        const next = { ...current, alert };
        const err = await save(next);
        if (err) return err;
        const push = !body.clear && body.push ? await pushAll(env, alert.title, alert.text, { target: alert.target }) : null;
        if (!body.clear) await logBroadcast(env, 'banner', alert.title, alert.text, alert.target);
        return json({ content: next, push });
      }
      if (path === 'admin/push' && method === 'POST') {
        const title = clean(body.title, 60), text = clean(body.text, 160);
        if (title.length < 2) return bad('Add a title.');
        const target = targetOk(body.target);
        const image = typeof body.image === 'string' && /^https:\/\/\S{4,400}$/.test(body.image) ? body.image : '';
        const push = await pushAll(env, title, text, { target }, image);
        await logBroadcast(env, 'notification', title, text, target);
        return json({ push });
      }
      if (path === 'admin/signups' && method === 'GET') {
        const content = await getContent(env);
        const out = {};
        for (const e of content.events.filter((x) => x.signup === 'app')) {
          out[e.id] = ((await env.CTEEN.get('signups:' + e.id, 'json')) || []).map((r) => ({ name: r.name, grade: r.grade, age: r.age ?? null, gender: r.gender || '', school: r.school || '', at: r.at }));
        }
        return json({ signups: out, phones: Object.keys((await env.CTEEN.get('push', 'json')) || {}).length });
      }
      if (path === 'admin/inbox' && method === 'GET') {
        return json({ inbox: ((await env.CTEEN.get('inbox', 'json')) || []).map((q) => ({ id: q.id, name: q.name, text: q.text, at: q.at })) });
      }
      if (path === 'admin/inbox/remove' && method === 'POST') {
        const inbox = ((await env.CTEEN.get('inbox', 'json')) || []).filter((q) => q.id !== body.id);
        await env.CTEEN.put('inbox', JSON.stringify(inbox));
        return json({ ok: true });
      }
      if (path === 'admin/photos' && method === 'GET') {
        const id = url.searchParams.get('challenge') || '';
        if (!idOk(id)) return bad('Bad request.');
        const days = [];
        for (let i = 0; i < 7; i++) days.push(nyDate(new Date(Date.now() - i * 86400000)));
        const out = [];
        for (const d of days) for (const p of (await env.CTEEN.get(`photos:${id}:${d}`, 'json')) || []) out.push({ key: p.key, name: p.name, at: p.at, day: d, status: p.status || '', comments: p.comments || [] });
        return json({ photos: out });
      }
      if (path === 'admin/people' && method === 'GET') {
        const admins = (await env.CTEEN.get('admins', 'json')) || {};
        const list = await env.CTEEN.list({ prefix: 'account:', limit: 1000 });
        const people = [];
        for (const k of list.keys.slice(0, 500)) {
          const a = await env.CTEEN.get(k.name, 'json');
          if (!a || !a.name) continue;
          people.push({ id: a.id, name: a.name, grade: a.grade || '', age: a.age ?? null, gender: a.gender || '', created: a.created || '', via: a.apple ? 'Apple' : a.google ? 'Google' : 'Name', leader: !!admins[a.id] });
        }
        people.sort((x, y) => String(y.created).localeCompare(String(x.created)));
        return json({ people, owner: !!auth.owner });
      }
      if (path === 'admin/leaders' && method === 'POST') {
        if (!auth.owner) return bad('Only Rabbi Zevy (with the leader passcode) can change who is a leader.', 403);
        if (!idOk(body.id)) return bad('Bad request.');
        const acc = await env.CTEEN.get('account:' + body.id, 'json');
        if (!acc) return bad('That person was not found.', 404);
        const admins = (await env.CTEEN.get('admins', 'json')) || {};
        if (body.on) admins[body.id] = { name: acc.name, at: new Date().toISOString() };
        else delete admins[body.id];
        await env.CTEEN.put('admins', JSON.stringify(admins));
        return json({ ok: true, leader: !!body.on });
      }
      if (path === 'admin/photo-status' && method === 'POST') {
        const status = ['checked', 'hidden'].includes(body.status) ? body.status : '';
        const ok = await editPhotoEntry(env, String(body.key || ''), (p) => { p.status = status; });
        return ok ? json({ ok: true }) : bad('That photo is gone.', 404);
      }
      if (path === 'admin/invite-responses' && method === 'GET') {
        const content = await getContent(env);
        const ids = (content.invites || []).map((v) => v.id);
        const rows = await Promise.all(ids.map((id) => env.CTEEN.get('inviteans:' + id, 'json')));
        const out = {};
        ids.forEach((id, i) => { out[id] = (rows[i] || []).map((r) => ({ name: r.name, answer: r.answer, at: r.at })); });
        return json({ responses: out });
      }
      if (path === 'admin/ai-event' && method === 'POST') {
        const prompt = clean(body.prompt, 600), info = clean(body.info, 2000);
        if (prompt.length + info.length < 4) return bad('Tell the AI what the event is.');
        const keep = body.keep !== false;
        const out = await aiJson(env,
          'You help Rabbi Zevy of CTeen Great Neck (a Jewish teen chapter at Chabad of Great Neck, 400 East Shore Road, Great Neck NY) set up an event in the chapter app. Reply with JSON only: {"title","date":"YYYY-MM-DD","time","place","about","who","price","post":{"title","body"}}. ' +
          (keep
            ? 'KEEP MODE: use the details exactly as given. Do not invent dates, times, places, prices or names. Leave a field empty ("") if it was not given. Only tidy the wording.'
            : 'IMPROVE MODE: keep every fact that was given exactly, and you may make the title catchier and the description more exciting for teens, and suggest a time if none was given (say "suggested" nowhere, just give a normal time). Never invent prices, names or dates that were not given; leave unknown dates empty.') +
          ' title: max 60 chars. about: 2-4 friendly sentences for teens, max 500 chars. who: who it is for, short. post: a short Feed announcement for it. No emojis, no hashtags, no markdown. Resolve words like "next Thursday" using today\'s date.',
          `Today is ${nyDate()} (${new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/New_York' })}).\nIdea: ${prompt}\nDetails from the rabbi: ${info || '(none)'}`);
        if (!out || !out.title) return bad('The AI could not plan that. Try again with a little more detail.', 502);
        const noEmoji = (s) => String(s || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/[*_#]/g, '').trim();
        return json({
          title: clean(noEmoji(out.title), 80), date: dateOk(out.date) ? out.date : '', time: clean(noEmoji(out.time), 40), place: clean(noEmoji(out.place), 120),
          about: clean(noEmoji(out.about), 1200), who: clean(noEmoji(out.who), 300), price: clean(noEmoji(out.price), 40),
          post: out.post && typeof out.post === 'object' ? { title: clean(noEmoji(out.post.title), 120), body: clean(noEmoji(out.post.body), 1500) } : null,
        });
      }
      if (path === 'admin/push-me' && method === 'POST') {
        const device = clean(body.device, 40);
        if (!device) return bad('Bad request.');
        const leaders = (await env.CTEEN.get('pushadmins', 'json')) || {};
        leaders[device] = 1;
        await env.CTEEN.put('pushadmins', JSON.stringify(leaders));
        return json({ ok: true });
      }
      if (path === 'admin/media' && method === 'POST') {
        const photo = typeof body.photo === 'string' ? body.photo.replace(/^data:image\/\w+;base64,/, '') : '';
        if (!/^[A-Za-z0-9+/=]{2000,}$/.test(photo)) return bad('That photo did not come through. Try again.');
        if (photo.length > 1500000) return bad('That photo is too big.');
        const mid = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
        await env.CTEEN.put('media:' + mid, photo);
        return json({ url: new URL('/api/media/' + mid, request.url).toString() });
      }
      if (path === 'admin/ai-draft' && method === 'POST') {
        const text = clean(body.text, 4000);
        if (text.length < 5) return bad('Paste the WhatsApp message first.');
        const out = await aiJson(env,
          'You turn a WhatsApp announcement from Rabbi Zevy (CTeen Great Neck, a Jewish teen chapter at Chabad of Great Neck, NY) into a post for the chapter app Feed. Reply with JSON only: {"title","body","kind","event"}. title: max 60 chars, clear and friendly. body: max 600 chars, plain sentences for teens, keep every fact (dates, times, places, prices, names, links) exactly as given and add NOTHING that is not in the message. NO emojis, no hashtags, no asterisks or markdown. kind: one of "News","Events","Photos","Rewards","Food" (Food when it is about what food is being served). event: if the message announces a specific event with a date, {"title","date":"YYYY-MM-DD","time","place"} using today\'s date to resolve words like "this Sunday"; otherwise null.',
          `Today is ${nyDate()} (${new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/New_York' })}).\nWhatsApp message:\n${text}`);
        if (!out || !out.title) return bad('The AI could not read that. Try again, or write the post yourself.', 502);
        const noEmoji = (s) => String(s || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/[*_#]/g, '').replace(/\s+\n/g, '\n').trim();
        const ev = out.event && typeof out.event === 'object' && dateOk(out.event.date) ? { title: clean(noEmoji(out.event.title || out.title), 80), date: out.event.date, time: clean(out.event.time, 40), place: clean(out.event.place, 120) } : null;
        return json({ title: clean(noEmoji(out.title), 120), body: clean(noEmoji(out.body), 1500), kind: KINDS.includes(out.kind) ? out.kind : 'News', event: ev });
      }
      if (path === 'admin/minyan-from-text' && method === 'POST') {
        const text = clean(body.text, 4000);
        if (text.length < 5) return bad('Paste the schedule first.');
        const cur = (await getContent(env)).minyan || MINYAN_DEFAULT;
        const minyan = await minyanFromText(env, cur, text);
        return minyan ? json({ minyan }) : bad('The AI could not read that. Try again, or type the times yourself.', 502);
      }
      if (path === 'admin/post-comment-delete' && method === 'POST') {
        if (!idOk(body.post)) return bad('Bad request.');
        const key = 'pm:' + body.post;
        const row = (await env.CTEEN.get(key, 'json')) || { likes: [], comments: [] };
        row.comments = (row.comments || []).filter((c) => c.at !== body.at);
        await env.CTEEN.put(key, JSON.stringify(row));
        return json({ ok: true });
      }
      if (path === 'admin/comment-delete' && method === 'POST') {
        const ok = await editPhotoEntry(env, String(body.key || ''), (p) => { p.comments = (p.comments || []).filter((c) => c.at !== body.at); });
        return ok ? json({ ok: true }) : bad('That photo is gone.', 404);
      }
      if (path === 'admin/photo' && method === 'GET') {
        const key = url.searchParams.get('key') || '';
        if (!/^photo:[a-z0-9-]+:\d{4}-\d{2}-\d{2}:[A-Za-z0-9-]+$/.test(key)) return bad('Bad request.');
        const data = await env.CTEEN.get(key);
        return data ? json({ photo: data }) : bad('That photo was deleted.', 404);
      }
    }
    return bad('Not found.', 404);
  } catch (err) {
    return bad('Server error.', 500);
  }
}
