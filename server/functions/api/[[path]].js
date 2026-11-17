// CTeen GN backend (Cloudflare Pages Function + KV binding CTEEN).
//
// Public
//   GET  /api/content                      live banner, events, challenges, posts, info
//   POST /api/account                      create or update a profile { id?, token?, name, grade, age, gender }
//   GET  /api/auth/config                  { google: true|false }
//   GET  /api/auth/google/start?app=...    begins "Link with Google" (redirects to Google)
//   GET  /api/auth/google/callback         Google returns here; redirects back to the app with a ticket
//   POST /api/auth/redeem                  { ticket, id?, token? } -> links Google to the account, or signs in
//   POST /api/events/:id/signup|cancel     { id, token } (or legacy { device, name, grade })
//   POST /api/challenges/:id/checkin       { id, token, photo? } one per day or week; photo is a small JPEG (base64)
//   GET  /api/challenges/:id/board         top names + counts
//   POST /api/push/register                { token, device }
//   POST /api/ask                          { name, text, device } question for the rabbi
// Leaders (Authorization: Bearer <passcode>)
//   POST /api/admin/check, PUT /api/admin/content, POST /api/admin/alert, POST /api/admin/push
//   GET  /api/admin/signups, GET /api/admin/inbox, POST /api/admin/inbox/remove
//   GET  /api/admin/photos?challenge=ID    check-in photos from the last 7 days (newest first)
//   GET  /api/admin/photo?key=KEY          one photo
import SEED from '../../../shared/seed.json';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

// Leader auth: passcode in the Authorization header, with a per-IP lockout after 6 misses.
async function isLeader(request, env) {
  if (!env.ADMIN_PASSCODE) return { ok: false, status: 503, msg: 'Leader passcode is not set up on the server.' };
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const lockKey = 'lock:' + ip;
  const misses = Number((await env.CTEEN.get(lockKey)) || 0);
  if (misses >= 6) return { ok: false, status: 429, msg: 'Too many wrong tries. Wait 15 minutes.' };
  const given = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (given && (await sameSecret(given, env.ADMIN_PASSCODE))) return { ok: true };
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
const publicAccount = (a) => ({ id: a.id, name: a.name, grade: a.grade, age: a.age, gender: a.gender, google: a.google ? { email: a.google.email } : null });
function profileFields(b) {
  const age = Number(b.age);
  return {
    name: clean(b.name, 40),
    grade: clean(b.grade, 4),
    age: Number.isFinite(age) && age >= 10 && age <= 25 ? Math.round(age) : null,
    gender: GENDERS.includes(b.gender) ? b.gender : '',
  };
}

// Who is acting: a signed-in account, or (older app versions) a bare device id.
async function actor(env, b) {
  if (b.id && b.token) {
    const acc = await getAccount(env, b.id, b.token);
    if (!acc) return { error: 'Please sign in again.' };
    return { key: acc.id, name: acc.name, grade: acc.grade, age: acc.age, gender: acc.gender };
  }
  const device = clean(b.device, 40);
  if (device.length < 8) return { error: 'Bad request.' };
  return { key: device, name: clean(b.name, 40), grade: clean(b.grade, 12), age: null, gender: '' };
}

async function getContent(env) {
  const c = (await env.CTEEN.get('content', 'json')) || SEED;
  if (c.alert && c.alert.on && c.alert.until && c.alert.until < new Date().toISOString()) c.alert = { ...c.alert, on: false };
  return c;
}

const KINDS = ['News', 'Events', 'Photos', 'Rewards'];
const COLORS = ['blue', 'orange', 'purple', 'green', 'pink', 'yellow'];
const dateOk = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const urlOk = (v) => typeof v === 'string' && /^(https:\/\/|mailto:|tel:)/.test(v) && v.length < 400;
const targetOk = (t) => (t && ['event', 'challenge'].includes(t.type) && idOk(t.id) ? { type: t.type, id: t.id } : null);
const ageOk = (v) => { const n = Number(v); return v !== '' && v != null && Number.isFinite(n) && n >= 10 && n <= 25 ? Math.round(n) : null; };

// Rebuild the document field by field so nothing unexpected is ever stored.
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
    })),
    challenges: list(doc.challenges, 20).filter((c) => idOk(c.id)).map((c) => ({
      id: c.id, title: clean(c.title, 60), icon: clean(c.icon, 20), color: color(c.color), every: c.every === 'week' ? 'week' : 'day',
      goal: Math.min(366, Math.max(1, Number(c.goal) || 1)), about: clean(c.about, 400), active: c.active !== false, photo: !!c.photo,
      rewards: list(c.rewards, 8).map((r) => ({ at: Math.min(366, Math.max(1, Number(r.at) || 1)), prize: clean(r.prize, 80) })).sort((x, y) => x.at - y.at),
    })),
    posts: list(doc.posts, 200).filter((p) => idOk(p.id)).map((p) => ({
      id: p.id, kind: KINDS.includes(p.kind) ? p.kind : 'News', pinned: !!p.pinned, title: clean(p.title, 120), body: clean(p.body, 1500),
      eventId: idOk(p.eventId) ? p.eventId : '', challengeId: idOk(p.challengeId) ? p.challengeId : '',
      photos: list(p.photos, 10).filter(urlOk), linkLabel: clean(p.linkLabel, 60), linkUrl: urlOk(p.linkUrl) ? p.linkUrl : '', at: dateOk(p.at) ? p.at : nyDate(),
    })),
    info: list(doc.info, 30).filter((i) => idOk(i.id)).map((i) => ({ id: i.id, icon: clean(i.icon, 20), title: clean(i.title, 60), body: clean(i.body, 600) })),
  };
}

async function pushAll(env, title, body, data) {
  const tokens = Object.values((await env.CTEEN.get('push', 'json')) || {});
  let sent = 0;
  for (let i = 0; i < tokens.length; i += 100) {
    const batch = tokens.slice(i, i + 100).map((to) => ({ to, title, body, sound: 'default', data: data || {} }));
    const res = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(batch) }).catch(() => null);
    if (res && res.ok) sent += batch.length;
  }
  return { phones: tokens.length, sent };
}

// Only app links of this app may receive a sign-in ticket.
const APP_RETURN = /^(cteengn:\/\/|exp:\/\/|exps:\/\/|https?:\/\/localhost(:\d+)?\/)/;

export async function onRequest({ request, env, params }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (!env.CTEEN) return bad('Storage is not connected.', 503);
  const url = new URL(request.url);
  const path = (params.path || []).join('/');
  const method = request.method;
  const body = method === 'POST' || method === 'PUT' ? await request.json().catch(() => null) : null;
  if ((method === 'POST' || method === 'PUT') && !body) return bad('Bad request.');

  try {
    if (path === 'content' && method === 'GET') return json(await getContent(env));

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

    // ── events ──
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
        rows.push({ name: who.name, grade: who.grade, age: who.age, gender: who.gender, device: who.key, at: new Date().toISOString() });
      }
      await env.CTEEN.put(key, JSON.stringify(rows));
      return json({ ok: true, going: action === 'signup', count: rows.length });
    }

    // ── challenges ──
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
        const row = board[who.key] || { name: who.name, count: 0, last: '' };
        if (row.last === period) return json({ ok: true, already: true, count: row.count, period, board: top() });
        let photoKey = '';
        if (ch.photo) {
          const photo = typeof body.photo === 'string' ? body.photo : '';
          if (!/^[A-Za-z0-9+/=]{2000,}$/.test(photo)) return bad('Take a photo to check in.');
          if (photo.length > 700000) return bad('That photo is too big. Try again.');
          photoKey = `photo:${id}:${period}:${who.key}`;
          await env.CTEEN.put(photoKey, photo, { expirationTtl: PHOTO_TTL });
          const listKey = `photos:${id}:${period}`;
          const list = ((await env.CTEEN.get(listKey, 'json')) || []).filter((p) => p.key !== photoKey);
          list.unshift({ key: photoKey, name: who.name, at: new Date().toISOString() });
          await env.CTEEN.put(listKey, JSON.stringify(list.slice(0, 500)), { expirationTtl: PHOTO_TTL });
        }
        if (!board[who.key] && Object.keys(board).length >= 1000) return bad('Leaderboard is full.', 409);
        board[who.key] = { name: who.name, count: Math.min(row.count + 1, 9999), last: period };
        await env.CTEEN.put(key, JSON.stringify(board));
        return json({ ok: true, already: false, count: board[who.key].count, period, board: top() });
      }
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
      if (path === 'admin/check' && method === 'POST') return json({ ok: true });
      const save = async (next) => {
        const text = JSON.stringify(next);
        if (text.length > 400000) return bad('Too much content.', 413);
        await env.CTEEN.put('content', text);
        return null;
      };
      if (path === 'admin/content' && method === 'PUT') {
        const current = await getContent(env);
        const next = sanitize(body, current.alert || SEED.alert);
        return (await save(next)) || json(next);
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
        return json({ content: next, push });
      }
      if (path === 'admin/push' && method === 'POST') {
        const title = clean(body.title, 60), text = clean(body.text, 160);
        if (title.length < 2) return bad('Add a title.');
        return json({ push: await pushAll(env, title, text, { target: targetOk(body.target) }) });
      }
      if (path === 'admin/signups' && method === 'GET') {
        const content = await getContent(env);
        const out = {};
        for (const e of content.events.filter((x) => x.signup === 'app')) {
          out[e.id] = ((await env.CTEEN.get('signups:' + e.id, 'json')) || []).map((r) => ({ name: r.name, grade: r.grade, age: r.age ?? null, gender: r.gender || '', at: r.at }));
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
        for (const d of days) for (const p of (await env.CTEEN.get(`photos:${id}:${d}`, 'json')) || []) out.push({ ...p, day: d });
        return json({ photos: out });
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
