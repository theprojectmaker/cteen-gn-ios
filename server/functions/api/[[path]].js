// CTeen GN backend (Cloudflare Pages Function + KV binding CTEEN).
//   GET  /api/content                      public: live banner, events, challenges, posts, info
//   POST /api/events/:id/signup|cancel     public: { name, grade, device }
//   POST /api/challenges/:id/checkin       public: { name, device } (one per day or week)
//   GET  /api/challenges/:id/board         public: top names + counts
//   POST /api/push/register                public: { token, device } (Expo push token)
//   POST /api/ask                          public: { name, text, device } question for the rabbi
//   POST /api/admin/check                  leader passcode check
//   PUT  /api/admin/content                leader: replace events, challenges, posts, info
//   POST /api/admin/alert                  leader: set/clear the live banner, optionally push it
//   POST /api/admin/push                   leader: send a notification to everyone
//   GET  /api/admin/signups                leader: sign-ups for every event
//   GET  /api/admin/inbox                  leader: questions; POST /api/admin/inbox/remove { id }
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

async function sameSecret(a, b) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  const p = new Uint8Array(x), q = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < p.length; i++) diff |= p[i] ^ q[i];
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

async function getContent(env) {
  const c = (await env.CTEEN.get('content', 'json')) || SEED;
  // A live banner past its end time is simply off.
  if (c.alert && c.alert.on && c.alert.until && c.alert.until < new Date().toISOString()) c.alert = { ...c.alert, on: false };
  return c;
}

const KINDS = ['News', 'Events', 'Photos', 'Rewards'];
const COLORS = ['blue', 'orange', 'purple', 'green', 'pink', 'yellow'];
const dateOk = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const urlOk = (v) => typeof v === 'string' && /^(https:\/\/|mailto:|tel:)/.test(v) && v.length < 400;
const targetOk = (t) => (t && ['event', 'challenge'].includes(t.type) && idOk(t.id) ? { type: t.type, id: t.id } : null);

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
    })),
    challenges: list(doc.challenges, 20).filter((c) => idOk(c.id)).map((c) => ({
      id: c.id, title: clean(c.title, 60), icon: clean(c.icon, 20), color: color(c.color), every: c.every === 'week' ? 'week' : 'day',
      goal: Math.min(366, Math.max(1, Number(c.goal) || 1)), about: clean(c.about, 400), active: c.active !== false,
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

// Send one notification to every registered phone through Expo's push service.
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

export async function onRequest({ request, env, params }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (!env.CTEEN) return bad('Storage is not connected.', 503);
  const path = (params.path || []).join('/');
  const method = request.method;
  const body = method === 'POST' || method === 'PUT' ? await request.json().catch(() => null) : null;
  if ((method === 'POST' || method === 'PUT') && !body) return bad('Bad request.');

  try {
    if (path === 'content' && method === 'GET') return json(await getContent(env));

    let m = /^events\/([a-z0-9-]+)\/(signup|cancel)$/.exec(path);
    if (m && method === 'POST') {
      const [, id, action] = m;
      const content = await getContent(env);
      const ev = content.events.find((e) => e.id === id);
      if (!ev || ev.signup !== 'app') return bad('This event does not take sign-ups in the app.', 404);
      const device = clean(body.device, 40);
      if (device.length < 8) return bad('Bad request.');
      const key = 'signups:' + id;
      const rows = ((await env.CTEEN.get(key, 'json')) || []).filter((r) => r.device !== device);
      if (action === 'signup') {
        const name = clean(body.name, 40), grade = clean(body.grade, 12);
        if (name.length < 2) return bad('Add your name.');
        if (rows.length >= 500) return bad('This event is full.', 409);
        rows.push({ name, grade, device, at: new Date().toISOString() });
      }
      await env.CTEEN.put(key, JSON.stringify(rows));
      return json({ ok: true, going: action === 'signup', count: rows.length });
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
        const device = clean(body.device, 40), name = clean(body.name, 24);
        if (device.length < 8 || name.length < 2) return bad('Add your name first.');
        const period = periodKey(ch.every);
        const row = board[device] || { name, count: 0, last: '' };
        if (row.last === period) return json({ ok: true, already: true, count: row.count, period, board: top() });
        if (!board[device] && Object.keys(board).length >= 1000) return bad('Leaderboard is full.', 409);
        board[device] = { name, count: Math.min(row.count + 1, 9999), last: period };
        await env.CTEEN.put(key, JSON.stringify(board));
        return json({ ok: true, already: false, count: board[device].count, period, board: top() });
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
          out[e.id] = ((await env.CTEEN.get('signups:' + e.id, 'json')) || []).map((r) => ({ name: r.name, grade: r.grade, at: r.at }));
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
    }
    return bad('Not found.', 404);
  } catch (err) {
    return bad('Server error.', 500);
  }
}
