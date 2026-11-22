// CTeen GN leader dashboard: a desktop front end for the same /api/admin routes the app's leader panel uses.
'use strict';
const API = '/api';
const $ = (s, el = document) => el.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
const newId = (p) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const fmtDay = (d) => { try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); } catch { return d; } };
const fmtAt = (s) => { try { return new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch { return s; } };
const KINDS = ['News', 'Events', 'Photos', 'Rewards', 'Food'];

let pass = '';
try { pass = sessionStorage.getItem('cteen-pass') || ''; } catch {}
let content = null, owner = false, view = 'overview';

async function api(path, opts = {}) {
  const headers = { 'content-type': 'application/json' };
  if (path.startsWith('/admin/')) headers.authorization = 'Bearer ' + pass;
  const r = await fetch(API + path, { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined, cache: 'no-store' });
  let data = {};
  try { data = await r.json(); } catch {}
  if (!r.ok) {
    if (r.status === 401 && path.startsWith('/admin/')) { signOut(); }
    throw new Error(data.error || data.message || 'Something went wrong (' + r.status + ').');
  }
  return data;
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2600); }
async function loadContent() { content = await api('/content?fresh=' + Date.now()); return content; }
async function saveContent(next, msg) {
  const r = await api('/admin/content', { method: 'PUT', body: next });
  content = r; toast(msg || 'Saved. Phones update right away.'); return r;
}

// ── sign in ──
async function signIn(p) {
  pass = p;
  const r = await api('/admin/check', { method: 'POST', body: {} });
  owner = !!r.owner;
  try { sessionStorage.setItem('cteen-pass', p); } catch {}
  $('#login').classList.add('hide'); $('#app').classList.remove('hide');
  await loadContent();
  show(location.hash.slice(1) || 'overview');
  refreshQuestionCount();
}
function signOut() {
  pass = ''; try { sessionStorage.removeItem('cteen-pass'); } catch {}
  $('#app').classList.add('hide'); $('#login').classList.remove('hide');
}
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault(); $('#loginErr').textContent = '';
  try { await signIn($('#pass').value.trim()); } catch (err) { $('#loginErr').textContent = err.message; pass = ''; }
});
$('#signOut').addEventListener('click', (e) => { e.preventDefault(); signOut(); });
$('#nav').addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (b) show(b.dataset.v); });
window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (v && v !== view && pass) show(v); });

const VIEWS = {};
async function show(v) {
  if (!VIEWS[v]) v = 'overview';
  view = v; if (location.hash.slice(1) !== v) history.replaceState(null, '', '#' + v);
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
  const main = $('#main');
  main.innerHTML = '<div class="empty">Loading…</div>';
  try { await VIEWS[v](main); } catch (err) { main.innerHTML = `<div class="card err">${esc(err.message)}</div>`; }
}
const head = (title, sub, actions = '') => `<div class="head"><div><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div><div class="row">${actions}</div></div>`;

// ── dialog helper: fields → values ──
function dialog(title, bodyHtml, { ok = 'Save', danger = '' } = {}) {
  const d = $('#dlg');
  $('#dlgTitle').textContent = title;
  $('#dlgBody').innerHTML = bodyHtml + '<div class="err" id="dlgErr"></div>';
  $('#dlgFoot').innerHTML = (danger ? `<button class="btn danger" value="danger" style="margin-right:auto">${esc(danger)}</button>` : '') + `<button class="btn sec" value="cancel" formnovalidate>Cancel</button><button class="btn" value="ok">${esc(ok)}</button>`;
  d.showModal();
  return new Promise((resolve) => {
    const onClose = () => { d.removeEventListener('close', onClose); resolve(d.returnValue); };
    d.addEventListener('close', onClose);
  });
}
// Keeps the dialog open while an async save runs; closes on success, shows the error otherwise.
function dialogLoop(title, bodyHtml, opts, onOk, onDanger) {
  return new Promise((resolve) => {
    const d = $('#dlg');
    dialog(title, bodyHtml, opts);
    if (opts && opts.after) opts.after();
    const form = $('#dlgForm');
    const handler = async (e) => {
      const v = e.submitter && e.submitter.value;
      if (v !== 'ok' && v !== 'danger') return;
      e.preventDefault();
      const btns = d.querySelectorAll('.df button'); btns.forEach((b) => (b.disabled = true));
      $('#dlgErr').textContent = '';
      try { await (v === 'ok' ? onOk() : onDanger()); form.removeEventListener('submit', handler); d.close('done'); resolve(true); }
      catch (err) { $('#dlgErr').textContent = err.message; btns.forEach((b) => (b.disabled = false)); }
    };
    form.addEventListener('submit', handler);
    d.addEventListener('close', () => { form.removeEventListener('submit', handler); resolve(false); }, { once: true });
  });
}
const field = (id, label, value = '', type = 'text', extra = '') => `<label class="f"><span>${esc(label)}</span>${type === 'area' ? `<textarea id="${id}" ${extra}>${esc(value)}</textarea>` : `<input type="${type}" id="${id}" value="${esc(value)}" ${extra}>`}</label>`;
const select = (id, label, options, value) => `<label class="f"><span>${esc(label)}</span><select id="${id}">${options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
const check = (id, label, on) => `<label class="check"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}> ${esc(label)}</label>`;
const val = (id) => { const el = document.getElementById(id); return el ? (el.type === 'checkbox' ? el.checked : el.value.trim()) : ''; };
const photoField = (id, label, url) => `<label class="f"><span>${esc(label)}</span><div class="row"><img id="${id}Prev" class="thumb ${url ? '' : 'hide'}" src="${esc(url || '')}" alt=""><input type="file" id="${id}" accept="image/*"><input type="hidden" id="${id}Url" value="${esc(url || '')}"></div></label>`;

// Shrinks a picked photo to at most 1600px JPEG, uploads it, returns its https URL.
async function uploadPhoto(file) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That file is not a photo.')); i.src = URL.createObjectURL(file); });
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  let q = 0.85, data = c.toDataURL('image/jpeg', q);
  while (data.length > 1400000 && q > 0.4) { q -= 0.15; data = c.toDataURL('image/jpeg', q); }
  const r = await api('/admin/media', { method: 'POST', body: { photo: data } });
  return r.url;
}
async function photoValue(id) {
  const input = document.getElementById(id);
  if (input && input.files && input.files[0]) return uploadPhoto(input.files[0]);
  return val(id + 'Url');
}
function wirePhoto(id) {
  const input = document.getElementById(id); if (!input) return;
  input.addEventListener('change', () => { const f = input.files[0]; const p = document.getElementById(id + 'Prev'); if (f) { p.src = URL.createObjectURL(f); p.classList.remove('hide'); } });
}
function csv(name, rows) {
  const text = rows.map((r) => r.map((c) => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); a.download = name + '.csv'; a.click();
}

// ═════ Overview ═════
VIEWS.overview = async (main) => {
  const [people, signups, inbox, bc] = await Promise.all([
    api('/admin/people').catch(() => ({ people: [] })), api('/admin/signups').catch(() => ({ signups: {}, phones: 0 })),
    api('/admin/inbox').catch(() => ({ inbox: [] })), api('/broadcasts').catch(() => ({ items: [] })),
  ]);
  const t = today();
  const upcoming = content.events.filter((e) => e.end >= t).sort((a, b) => a.start.localeCompare(b.start));
  const week = people.people.filter((p) => p.created && Date.now() - new Date(p.created) < 7 * 864e5).length;
  const acts = [
    ['post', 'New post', 'Share to the Feed'],
    ['event', 'New event', 'With sign-ups'],
    ['invite', 'Invitation', 'A personal invite'],
    ['broadcast', 'Notify everyone', 'Push, banner or pop-up'],
    ['photos', 'Tefillin photos', 'See today’s check-ins'],
    ['minyan', 'Minyan times', 'Edit the schedule'],
  ];
  main.innerHTML = head('Overview', new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })) +
    `<div class="quick">${acts.map(([k, t, s]) => `<button class="qa" data-do="${k}"><b>${esc(t)}</b><span>${esc(s)}</span></button>`).join('')}</div>
    <div class="grid g4" style="margin-top:16px">
      <div class="card stat"><div class="n">${people.people.length}</div><div class="l">Teens signed up${week ? ` · ${week} this week` : ''}</div></div>
      <div class="card stat"><div class="n">${signups.phones || 0}</div><div class="l">Phones with notifications</div></div>
      <div class="card stat"><div class="n">${upcoming.length}</div><div class="l">Upcoming events</div></div>
      <div class="card stat"><div class="n">${inbox.inbox.length}</div><div class="l">Open questions</div></div>
    </div>
    <div class="grid g2" style="margin-top:14px">
      <div class="card"><div class="spread"><h2>Coming up</h2><button class="btn sec sm" data-go="events">All events</button></div>
        <div class="list" style="margin-top:12px">${upcoming.slice(0, 5).map((e) => { const n = (signups.signups[e.id] || []).length; return `<div class="item"><div style="flex:1"><b>${esc(e.title)}</b><div class="small muted">${fmtDay(e.start)}${e.time ? ' · ' + esc(e.time) : ''}${e.place ? ' · ' + esc(e.place) : ''}</div></div><span class="tag ${n ? 'cy' : ''}">${e.signup === 'app' ? n + ' going' : 'CTeen site'}</span></div>`; }).join('') || '<div class="empty">No upcoming events.</div>'}</div></div>
      <div class="card"><div class="spread"><h2>Recently sent</h2></div>
        <div class="list" style="margin-top:12px">${(bc.items || []).slice(0, 6).map((b) => `<div class="item"><div style="flex:1"><b>${esc(b.title)}</b><div class="small muted">${esc((b.body || '').slice(0, 110))}</div></div><span class="small faint">${esc(fmtAt(b.at))}</span></div>`).join('') || '<div class="empty">Nothing sent yet.</div>'}</div></div>
    </div>`;
  main.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { show(b.dataset.go).then(() => { if (b.dataset.new) editPost(null); }); }));
  main.querySelectorAll('[data-do]').forEach((b) => b.addEventListener('click', async () => {
    const k = b.dataset.do;
    const target = k === 'post' ? 'posts' : k === 'event' ? 'events' : k === 'invite' ? 'invites' : k;
    await show(target);
    if (k === 'post') editPost(null); else if (k === 'event') editEvent(null); else if (k === 'invite') newInvite();
  }));
};

// ═════ Feed posts ═════
VIEWS.posts = async (main) => {
  await loadContent();
  const posts = [...content.posts].sort((a, b) => (b.pinned - a.pinned) || String(b.at).localeCompare(String(a.at)));
  main.innerHTML = head('Feed posts', 'Every new post sends a notification to every phone with a short summary.',
    `<button class="btn sec" id="waBtn">From WhatsApp</button><button class="btn" id="newPost">New post</button>`) +
    `<div class="card"><div class="list">${posts.map((p) => `<div class="item">${p.photos && p.photos[0] ? `<img class="thumb" src="${esc(p.photos[0])}" alt="">` : ''}
      <div style="flex:1;min-width:0"><div class="row"><b>${esc(p.title)}</b>${p.pinned ? '<span class="tag or">Pinned</span>' : ''}<span class="tag">${esc(p.kind)}</span></div>
      <div class="small muted" style="margin-top:3px">${esc((p.body || '').slice(0, 200))}</div><div class="small faint" style="margin-top:4px">${fmtDay(p.at)}</div></div>
      <div class="row"><button class="btn sec sm" data-pin="${esc(p.id)}">${p.pinned ? 'Unpin' : 'Pin'}</button><button class="btn sec sm" data-edit="${esc(p.id)}">Edit</button></div></div>`).join('') || '<div class="empty">No posts yet.</div>'}</div></div>`;
  $('#newPost').onclick = () => editPost(null);
  $('#waBtn').onclick = whatsApp;
  main.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => editPost(content.posts.find((p) => p.id === b.dataset.edit))));
  main.querySelectorAll('[data-pin]').forEach((b) => (b.onclick = async () => {
    b.disabled = true;
    await saveContent({ ...content, posts: content.posts.map((p) => (p.id === b.dataset.pin ? { ...p, pinned: !p.pinned } : p)) }, 'Updated.');
    show('posts');
  }));
};
// Slideshow photos: the ones already on the post (remove with x) and new picks, in order.
let keptSlides = [], pendingSlides = [];
function slidePicker(p) {
  keptSlides = [...(p.photos || [])].slice(0, 10);
  pendingSlides = [];
  const box = $('#pSlides'), input = $('#pFiles');
  const draw = () => {
    const thumbs = [
      ...keptSlides.map((u, i) => ['kept', i, u]),
      ...pendingSlides.map((f, i) => ['new', i, URL.createObjectURL(f)]),
    ];
    box.innerHTML = thumbs.map(([kind, i, src], n) => `<div class="slide"><img src="${esc(src)}" alt=""><span class="n">${n + 1}</span><button type="button" class="x" data-k="${kind}" data-i="${i}" aria-label="Remove photo">&times;</button></div>`).join('') || '<div class="faint small">No photos yet. A post can be text only.</div>';
    box.querySelectorAll('button[data-k]').forEach((b) => (b.onclick = () => {
      const i = Number(b.dataset.i);
      if (b.dataset.k === 'kept') keptSlides.splice(i, 1); else pendingSlides.splice(i, 1);
      draw();
    }));
  };
  input.addEventListener('change', () => {
    const room = 10 - keptSlides.length - pendingSlides.length;
    pendingSlides.push(...[...input.files].slice(0, Math.max(0, room)));
    input.value = '';
    draw();
  });
  draw();
}
async function editPost(p, draft) {
  const isNew = !p; p = p || { id: newId('p'), kind: 'News', pinned: false, title: '', body: '', eventId: '', challengeId: '', photos: [], linkLabel: '', linkUrl: '', at: today(), ...(draft || {}) };
  const evOpts = [['', 'None'], ...content.events.map((e) => [e.id, e.title])];
  const ok = await dialogLoop(isNew ? 'New post' : 'Edit post',
    field('pTitle', 'Title', p.title, 'text', 'maxlength="120" required') + field('pBody', 'Text', p.body, 'area', 'maxlength="1500"') +
    `<div class="grid g2">${select('pKind', 'Type', KINDS.map((k) => [k, k]), p.kind)}${select('pEvent', 'Links to event', evOpts, p.eventId)}</div>` +
    `<label class="f"><span>Photos (up to 10, in order: a slideshow in the Feed)</span><div id="pSlides" class="slides"></div><input type="file" id="pFiles" accept="image/*" multiple></label>` +
    '<p class="small muted" style="margin:6px 0 0">For an Instagram slideshow, save the pictures from the post and add them here, then paste the post link under Button link.</p>' +
    `<div class="grid g2">${field('pLinkLabel', 'Button text (optional)', p.linkLabel)}${field('pLinkUrl', 'Button link', p.linkUrl, 'text', 'placeholder="https://"')}</div>` +
    check('pPinned', 'Pin to the top of the Feed', p.pinned) + (isNew ? '<p class="small muted">Posting sends a notification to every phone.</p>' : ''),
    { ok: isNew ? 'Post it' : 'Save', danger: isNew ? '' : 'Delete', after: () => slidePicker(p) },
    async () => {
      if (val('pTitle').length < 2) throw new Error('Add a title.');
      const added = [];
      for (const file of pendingSlides) added.push(await uploadPhoto(file));
      pendingSlides = [];
      const photos = [...keptSlides, ...added].slice(0, 10);
      const next = { ...p, title: val('pTitle'), body: val('pBody'), kind: val('pKind'), eventId: val('pEvent'), linkLabel: val('pLinkLabel'), linkUrl: val('pLinkUrl'), pinned: val('pPinned'), photos };
      if (next.linkUrl && !/^https:\/\//.test(next.linkUrl)) throw new Error('The button link has to start with https://');
      await saveContent({ ...content, posts: isNew ? [next, ...content.posts] : content.posts.map((x) => (x.id === p.id ? next : x)) }, isNew ? 'Posted. Everyone gets a notification.' : 'Saved.');
    },
    async () => { if (!confirm('Delete this post?')) throw new Error('Not deleted.'); await saveContent({ ...content, posts: content.posts.filter((x) => x.id !== p.id) }, 'Deleted.'); });
  if (ok && view === 'posts') show('posts');
}
async function whatsApp() {
  let draft = null;
  const ok = await dialogLoop('From WhatsApp', '<p class="muted">Paste an announcement. The AI turns it into a Feed post you can check before it goes out. It keeps every fact and adds nothing.</p>' + field('waText', 'WhatsApp message', '', 'area', 'style="min-height:180px"'),
    { ok: 'Make the post' },
    async () => { const r = await api('/admin/ai-draft', { method: 'POST', body: { text: val('waText') } }); draft = r; });
  if (ok && draft) editPost(null, { title: draft.title, body: draft.body, kind: draft.kind });
}

// ═════ Events ═════
VIEWS.events = async (main) => {
  await loadContent();
  const s = await api('/admin/signups').catch(() => ({ signups: {} }));
  const t = today();
  const evs = [...content.events].sort((a, b) => a.start.localeCompare(b.start));
  const row = (e) => { const list = s.signups[e.id] || []; return `<tr><td><b>${esc(e.title)}</b>${e.scope === 'intl' ? ' <span class="tag cy">International</span>' : ''}<div class="small muted">${esc([e.time, e.place].filter(Boolean).join(' · '))}</div></td>
    <td>${fmtDay(e.start)}${e.end !== e.start ? ' – ' + fmtDay(e.end) : ''}</td><td>${e.gender === 'all' ? 'Both' : e.gender === 'boys' ? 'Boys' : 'Girls'}</td>
    <td>${e.signup === 'app' ? `<a href="#" data-going="${esc(e.id)}">${list.length} going</a>` : '<span class="muted">CTeen site</span>'}</td>
    <td style="text-align:right;white-space:nowrap"><button class="btn sec sm" data-dup="${esc(e.id)}">Copy</button> <button class="btn sec sm" data-edit="${esc(e.id)}">Edit</button></td></tr>`; };
  const up = evs.filter((e) => e.end >= t), past = evs.filter((e) => e.end < t).reverse();
  main.innerHTML = head('Events', 'New events notify every phone. Sign-ups show here as they come in.', `<button class="btn sec" id="aiBtn">Plan with AI</button><button class="btn" id="newEv">New event</button>`) +
    `<div class="card"><table><thead><tr><th>Event</th><th>When</th><th>For</th><th>Sign-ups</th><th></th></tr></thead><tbody>${up.map(row).join('') || '<tr><td colspan="5" class="empty">No upcoming events.</td></tr>'}</tbody></table></div>` +
    (past.length ? `<h2 style="margin:28px 0 12px">Past</h2><div class="card"><table><tbody>${past.slice(0, 15).map(row).join('')}</tbody></table></div>` : '');
  $('#newEv').onclick = () => editEvent(null);
  $('#aiBtn').onclick = aiPlan;
  main.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => editEvent(content.events.find((e) => e.id === b.dataset.edit))));
  main.querySelectorAll('[data-dup]').forEach((b) => (b.onclick = () => { const o = content.events.find((e) => e.id === b.dataset.dup); const { id, ...rest } = o; editEvent(null, { ...rest, title: o.title, start: '', end: '' }); }));
  main.querySelectorAll('[data-going]').forEach((a) => (a.onclick = (ev) => { ev.preventDefault(); const e = content.events.find((x) => x.id === a.dataset.going); showGoing(e, s.signups[e.id] || []); }));
};
function showGoing(e, list) {
  dialog(e.title + ' · ' + list.length + ' going', list.length ? `<table><thead><tr><th>Name</th><th>Grade</th><th>Age</th><th>Signed up</th></tr></thead><tbody>${list.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.grade ? r.grade + 'th' : '')}</td><td>${esc(r.age ?? '')}</td><td class="small muted">${esc(fmtAt(r.at))}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Nobody yet.</div>', { ok: 'Done' });
  if (list.length) { const b = document.createElement('button'); b.className = 'btn sec'; b.type = 'button'; b.textContent = 'Download list'; b.onclick = () => csv(e.title, [['Name', 'Grade', 'Age', 'Signed up'], ...list.map((r) => [r.name, r.grade, r.age ?? '', r.at])]); $('#dlgFoot').prepend(b); }
}
async function editEvent(e, draft) {
  const isNew = !e;
  e = e || { id: newId('e'), title: '', icon: 'calendar', color: 'blue', image: '', scope: 'gn', start: '', end: '', time: '', place: '', price: '', who: '', about: '', signup: 'app', url: '', payUrl: '', gender: 'all', minAge: null, maxAge: null, poster: '', showGoing: false, ...(draft || {}) };
  const ok = await dialogLoop(isNew ? 'New event' : 'Edit event',
    field('eTitle', 'Name', e.title, 'text', 'maxlength="80"') +
    `<div class="grid g2">${field('eStart', 'Date', e.start, 'date')}${field('eEnd', 'Ends (if more than one day)', e.end !== e.start ? e.end : '', 'date')}</div>` +
    `<div class="grid g2">${field('eTime', 'Time', e.time, 'text', 'placeholder="7:00 PM"')}${field('ePlace', 'Place', e.place)}</div>` +
    field('eAbout', 'About', e.about, 'area', 'maxlength="1200"') +
    `<div class="grid g2">${field('ePrice', 'Price (optional)', e.price)}${select('eGender', 'Who it is for', [['all', 'Both'], ['boys', 'Boys'], ['girls', 'Girls']], e.gender)}</div>` +
    `<div class="grid g2">${field('eMin', 'Min age (optional)', e.minAge ?? '', 'number', 'min="10" max="25"')}${field('eMax', 'Max age (optional)', e.maxAge ?? '', 'number', 'min="10" max="25"')}</div>` +
    `<div class="grid g2">${select('eSignup', 'Sign-up', [['app', 'In the app'], ['link', 'On a website']], e.signup)}${field('eUrl', 'Website link', e.url, 'text', 'placeholder="https://"')}</div>` +
    photoField('ePoster', 'Poster', e.poster) +
    check('eShow', 'Let teens see who else is going (first names)', e.showGoing) +
    (isNew ? '<p class="small muted">Saving sends "New event: join now" to every phone.</p>' : ''),
    { ok: isNew ? 'Create event' : 'Save', danger: isNew ? '' : 'Delete', after: () => wirePhoto('ePoster') },
    async () => {
      if (val('eTitle').length < 2) throw new Error('Name the event.');
      if (!val('eStart')) throw new Error('Pick a date.');
      const url = val('eUrl'); if (url && !/^https:\/\//.test(url)) throw new Error('The link has to start with https://');
      const poster = await photoValue('ePoster');
      const num = (v) => (v === '' ? null : Number(v));
      const next = { ...e, title: val('eTitle'), start: val('eStart'), end: val('eEnd') && val('eEnd') >= val('eStart') ? val('eEnd') : val('eStart'), time: val('eTime'), place: val('ePlace'), about: val('eAbout'), price: val('ePrice'), gender: val('eGender'), minAge: num(val('eMin')), maxAge: num(val('eMax')), signup: val('eSignup'), url, poster, showGoing: val('eShow') };
      await saveContent({ ...content, events: isNew ? [...content.events, next] : content.events.map((x) => (x.id === e.id ? next : x)) }, isNew ? 'Event created. Everyone gets a notification.' : 'Saved.');
    },
    async () => { if (!confirm('Delete this event? Its sign-up list goes away from the app.')) throw new Error('Not deleted.'); await saveContent({ ...content, events: content.events.filter((x) => x.id !== e.id) }, 'Deleted.'); });
  if (ok && view === 'events') show('events');
}
async function aiPlan() {
  let out = null;
  const ok = await dialogLoop('Plan an event with AI', '<p class="muted">Describe it in a sentence and add any details you have. You check everything before it is saved.</p>' +
    field('aiPrompt', 'The idea', '', 'text', 'placeholder="Bake shop night for the girls next Thursday"') + field('aiInfo', 'Details (optional)', '', 'area', 'placeholder="Time, place, price, what to bring"') +
    `<label class="f"><span>How much should the AI change</span><select id="aiKeep"><option value="1">Keep my details exactly, just tidy the wording</option><option value="0">Make it more exciting for teens</option></select></label>`,
    { ok: 'Draft it' },
    async () => { out = await api('/admin/ai-event', { method: 'POST', body: { prompt: val('aiPrompt'), info: val('aiInfo'), keep: val('aiKeep') === '1' } }); });
  if (ok && out) editEvent(null, { title: out.title, start: out.date, end: out.date, time: out.time, place: out.place, about: out.about, who: out.who, price: out.price });
}

// ═════ Invitations ═════
VIEWS.invites = async (main) => {
  await loadContent();
  const r = await api('/admin/invite-responses').catch(() => ({ responses: {} }));
  const inv = content.invites || [];
  main.innerHTML = head('Invitations', 'A personal card on every Home screen, with each teen\'s name, until they answer.', `<button class="btn" id="newInv">New invitation</button>`) +
    `<div class="grid g2">${inv.map((v) => { const list = r.responses[v.id] || []; const yes = list.filter((x) => x.answer === 'yes'), no = list.filter((x) => x.answer === 'no');
      return `<div class="card"><div class="spread"><h3>${esc(v.title)}</h3><span class="tag ${v.on ? 'gr' : ''}">${v.on ? 'Showing' : 'Off'}</span></div>
      <p class="small muted pre" style="margin:6px 0 0">${esc(v.message)}</p>
      <div class="row" style="margin-top:12px"><span class="tag cy">${yes.length} in</span><span class="tag">${no.length} not this time</span><span class="small faint">${v.until ? 'Until ' + fmtDay(v.until) : ''}</span></div>
      ${yes.length ? `<p class="small" style="margin:8px 0 0">${yes.map((x) => esc(x.name)).join(', ')}</p>` : ''}
      <div class="row" style="margin-top:14px"><button class="btn sec sm" data-tog="${esc(v.id)}">${v.on ? 'Take down' : 'Put back up'}</button><button class="btn sec sm" data-del="${esc(v.id)}">Delete</button></div></div>`; }).join('') || '<div class="card empty">No invitations yet.</div>'}</div>`;
  $('#newInv').onclick = newInvite;
  main.querySelectorAll('[data-tog]').forEach((b) => (b.onclick = async () => { await saveContent({ ...content, invites: inv.map((v) => (v.id === b.dataset.tog ? { ...v, on: !v.on } : v)) }, 'Updated.'); show('invites'); }));
  main.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => { if (!confirm('Delete this invitation?')) return; await saveContent({ ...content, invites: inv.filter((v) => v.id !== b.dataset.del) }, 'Deleted.'); show('invites'); }));
};
async function newInvite() {
  const evOpts = [['', 'No event'], ...content.events.filter((e) => e.end >= today()).map((e) => [e.id, e.title])];
  const ok = await dialogLoop('New invitation',
    select('iEvent', 'For an event (optional)', evOpts, '') + field('iTitle', 'What it is for', '', 'text', 'placeholder="Bake shop night"') +
    field('iMsg', 'Your message', "Hey {name}, we'd love to see you there. It won't be the same without you!", 'area') + '<p class="small muted" style="margin:4px 0 0">{name} turns into each teen\'s first name.</p>' +
    field('iDetails', 'More info (optional)', '', 'area') + photoField('iPhoto', 'Picture (optional)', '') +
    `<div class="grid g2">${select('iWho', 'Who gets it', [['all', 'Everyone'], ['boys', 'Boys'], ['girls', 'Girls']], 'all')}${select('iDays', 'Keep it up for', [['3', '3 days'], ['7', '1 week'], ['14', '2 weeks']], '7')}</div>` +
    check('iRemind', 'Remind them twice a day until they answer', true) + '<p class="small muted">Sending notifies every phone it is for.</p>',
    { ok: 'Send invitation', after: () => { wirePhoto('iPhoto'); $('#iEvent').onchange = () => { const e = content.events.find((x) => x.id === val('iEvent')); if (e && !val('iTitle')) $('#iTitle').value = e.title; }; } },
    async () => {
      if (val('iTitle').length < 2) throw new Error('What are you inviting them to?');
      const ev = content.events.find((e) => e.id === val('iEvent'));
      const end = new Date(); end.setDate(end.getDate() + Number(val('iDays')));
      let until = end.toLocaleDateString('en-CA'); if (ev && ev.end < until) until = ev.end;
      const image = (await photoValue('iPhoto')) || (ev && ev.poster) || '';
      const v = { id: newId('i'), on: true, title: val('iTitle'), message: val('iMsg'), details: val('iDetails'), eventId: val('iEvent'), image, audience: val('iWho'), until, remind: val('iRemind'), at: new Date().toISOString() };
      await saveContent({ ...content, invites: [v, ...(content.invites || [])] }, 'Invitation sent.');
    });
  if (ok && view === 'invites') show('invites');
}

// ═════ Notify and banners ═════
VIEWS.broadcast = async (main) => {
  await loadContent();
  const a = content.alert || {}, p = content.popup || {};
  const targets = [['', 'Just open the app'], ...content.events.filter((e) => e.end >= today()).map((e) => ['event:' + e.id, 'Event: ' + e.title]), ...content.challenges.map((c) => ['challenge:' + c.id, 'Challenge: ' + c.title]), ...content.posts.slice(0, 15).map((x) => ['post:' + x.id, 'Post: ' + x.title])];
  const tgt = (v) => { if (!v) return null; const [type, id] = v.split(':'); return { type, id }; };
  const tgtVal = (t) => (t ? t.type + ':' + t.id : '');
  main.innerHTML = head('Notify and banners', 'Reach everyone right now.') + `<div class="grid g2">
    <form class="card" id="nForm"><h2>Notification</h2><p class="small muted" style="margin:4px 0 0">Goes to every phone with notifications on, and into everyone's Inbox.</p>
      ${field('nTitle', 'Title', '', 'text', 'maxlength="60"')}${field('nText', 'Message', '', 'area', 'maxlength="160" style="min-height:70px"')}${select('nTarget', 'Tapping it opens', targets, '')}
      <div class="err" id="nErr"></div><button class="btn" style="margin-top:16px">Send to everyone</button></form>
    <form class="card" id="bForm"><div class="spread"><h2>Live banner</h2>${a.on ? '<span class="tag gr">Showing</span>' : ''}</div><p class="small muted" style="margin:4px 0 0">A banner at the top of the app, for something happening now.</p>
      ${a.on ? `<div class="card" style="margin-top:12px;background:var(--cyanPale);border:0"><b>${esc(a.title)}</b><div class="small">${esc(a.text)}</div>${a.until ? `<div class="small faint">Until ${esc(fmtAt(a.until))}</div>` : ''}</div>` : ''}
      ${field('bTitle', 'Title', '', 'text', 'maxlength="60"')}${field('bText', 'Text', '', 'text', 'maxlength="160"')}
      <div class="grid g2">${select('bTarget', 'Tapping it opens', targets, '')}${select('bHours', 'Take it down after', [['2', '2 hours'], ['6', '6 hours'], ['24', '1 day'], ['72', '3 days'], ['0', 'When I take it down']], '6')}</div>
      ${check('bPush', 'Also send a notification', false)}
      <div class="err" id="bErr"></div><div class="row" style="margin-top:16px"><button class="btn">Put it up</button>${a.on ? '<button class="btn sec" type="button" id="bClear">Take it down</button>' : ''}</div></form>
    <form class="card" id="pForm" style="grid-column:1/-1"><div class="spread"><h2>Pop-up when the app opens</h2>${p.on ? '<span class="tag gr">On</span>' : '<span class="tag">Off</span>'}</div>
      <div class="grid g2"><div>${field('puTitle', 'Title', p.title, 'text', 'maxlength="80"')}${field('puBody', 'Text', p.body, 'area', 'maxlength="600"')}${field('puMore', 'More info (optional)', p.more, 'area', 'maxlength="800"')}</div>
      <div>${photoField('puImg', 'Poster (optional)', p.image)}${field('puBtn', 'Button text', p.button || 'Check it out', 'text', 'maxlength="30"')}${select('puTarget', 'Button opens', targets, tgtVal(p.target))}${check('puOn', 'Show it every time the app opens', p.on)}</div></div>
      <div class="err" id="pErr"></div><button class="btn" style="margin-top:16px">Save pop-up</button></form></div>`;
  wirePhoto('puImg');
  const run = (formId, errId, fn) => { $(formId).addEventListener('submit', async (ev) => { ev.preventDefault(); const btn = ev.submitter; $(errId).textContent = ''; btn.disabled = true; try { await fn(); } catch (err) { $(errId).textContent = err.message; } btn.disabled = false; }); };
  run('#nForm', '#nErr', async () => {
    if (val('nTitle').length < 2) throw new Error('Add a title.');
    if (!confirm('Send this to every phone now?')) return;
    const r = await api('/admin/push', { method: 'POST', body: { title: val('nTitle'), text: val('nText'), target: tgt(val('nTarget')) } });
    toast('Sent' + (r.push && r.push.sent != null ? ' to ' + r.push.sent + ' phones.' : '.')); $('#nForm').reset();
  });
  run('#bForm', '#bErr', async () => {
    if (val('bTitle').length < 2) throw new Error('Add a title.');
    await api('/admin/alert', { method: 'POST', body: { title: val('bTitle'), text: val('bText'), target: tgt(val('bTarget')), hours: Number(val('bHours')), push: val('bPush') } });
    toast('Banner is up.'); show('broadcast');
  });
  if ($('#bClear')) $('#bClear').onclick = async () => { await api('/admin/alert', { method: 'POST', body: { clear: true } }); toast('Banner taken down.'); show('broadcast'); };
  run('#pForm', '#pErr', async () => {
    const image = await photoValue('puImg');
    const changed = val('puTitle') !== p.title || val('puBody') !== p.body || image !== (p.image || '');
    const popup = { on: val('puOn'), id: changed || !p.id ? newId('pop') : p.id, title: val('puTitle'), body: val('puBody'), more: val('puMore'), button: val('puBtn'), image, target: tgt(val('puTarget')) };
    if (popup.on && popup.title.length < 2) throw new Error('Add a title.');
    await saveContent({ ...content, popup }, 'Pop-up saved.'); show('broadcast');
  });
};

// ═════ People ═════
VIEWS.people = async (main) => {
  const r = await api('/admin/people');
  const people = r.people;
  let q = '', g = '';
  main.innerHTML = head('People', people.length + ' teens have the app.', `<button class="btn sec" id="dl">Download list</button>`) +
    `<div class="row" style="margin-bottom:14px"><input type="search" id="q" placeholder="Search by name" style="max-width:280px"><div class="seg" id="seg"><button class="on" data-g="">Everyone</button><button data-g="boy">Boys</button><button data-g="girl">Girls</button><button data-g="leader">Leaders</button></div></div>
    <div class="card"><table><thead><tr><th>Name</th><th>Grade</th><th>Age</th><th></th><th>Joined</th><th>Signed in with</th>${r.owner ? '<th></th>' : ''}</tr></thead><tbody id="pt"></tbody></table></div>
    <p class="small muted">Grade, age and boy/girl are only shown to leaders. ${r.owner ? 'Leaders can use the leader panel in the app with their own account.' : 'Only Rabbi Zevy can change who is a leader.'}</p>`;
  const draw = () => {
    const list = people.filter((p) => (!q || p.name.toLowerCase().includes(q)) && (!g || (g === 'leader' ? p.leader : p.gender === g)));
    $('#pt').innerHTML = list.map((p) => `<tr><td><b>${esc(p.name)}</b> ${p.leader ? '<span class="tag or">Leader</span>' : ''}</td><td>${esc(p.grade ? p.grade + 'th' : '')}</td><td>${esc(p.age ?? '')}</td><td>${esc(p.gender === 'boy' ? 'Boy' : p.gender === 'girl' ? 'Girl' : '')}</td><td class="small muted">${p.created ? esc(fmtDay(p.created.slice(0, 10))) : ''}</td><td class="small muted">${esc(p.via)}</td>${r.owner ? `<td style="text-align:right"><button class="btn sec sm" data-lead="${esc(p.id)}" data-on="${p.leader ? '' : '1'}">${p.leader ? 'Remove leader' : 'Make leader'}</button></td>` : ''}</tr>`).join('') || '<tr><td colspan="7" class="empty">Nobody matches.</td></tr>';
    $('#pt').querySelectorAll('[data-lead]').forEach((b) => (b.onclick = async () => {
      const person = people.find((x) => x.id === b.dataset.lead);
      if (!confirm((b.dataset.on ? 'Make ' : 'Remove ') + person.name + (b.dataset.on ? ' a leader? They can post and send notifications.' : ' as a leader?'))) return;
      await api('/admin/leaders', { method: 'POST', body: { id: person.id, on: !!b.dataset.on } }); person.leader = !!b.dataset.on; toast('Updated.'); draw();
    }));
  };
  $('#q').oninput = (e) => { q = e.target.value.trim().toLowerCase(); draw(); };
  $('#seg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; g = b.dataset.g; $('#seg').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); draw(); };
  $('#dl').onclick = () => csv('CTeen GN people', [['Name', 'Grade', 'Age', 'Boy/Girl', 'Joined', 'Leader'], ...people.map((p) => [p.name, p.grade, p.age ?? '', p.gender, p.created, p.leader ? 'yes' : ''])]);
  draw();
};

// ═════ Questions ═════
async function refreshQuestionCount() { try { const r = await api('/admin/inbox'); const c = $('#qCount'); c.textContent = r.inbox.length; c.classList.toggle('hide', !r.inbox.length); } catch {} }
VIEWS.questions = async (main) => {
  const r = await api('/admin/inbox');
  main.innerHTML = head('Questions', 'Sent from "Ask Rabbi Zevy" in the app. Only leaders see them.') +
    `<div class="card"><div class="list">${r.inbox.map((q) => `<div class="item"><div style="flex:1"><div class="row"><b>${esc(q.name || 'Someone')}</b><span class="small faint">${esc(fmtAt(q.at))}</span></div><p class="pre" style="margin:4px 0 0">${esc(q.text)}</p></div><button class="btn sec sm" data-done="${esc(q.id)}">Done</button></div>`).join('') || '<div class="empty">No questions right now.</div>'}</div></div>`;
  main.querySelectorAll('[data-done]').forEach((b) => (b.onclick = async () => { await api('/admin/inbox/remove', { method: 'POST', body: { id: b.dataset.done } }); refreshQuestionCount(); show('questions'); }));
};

// ═════ Challenge photos ═════
VIEWS.photos = async (main) => {
  await loadContent();
  const chs = content.challenges.filter((c) => c.photo);
  if (!chs.length) { main.innerHTML = head('Challenge photos', '') + '<div class="card empty">No photo challenges.</div>'; return; }
  const id = VIEWS.photos.ch && chs.some((c) => c.id === VIEWS.photos.ch) ? VIEWS.photos.ch : chs[0].id;
  const r = await api('/admin/photos?challenge=' + encodeURIComponent(id));
  main.innerHTML = head('Challenge photos', 'The last 7 days. Hide anything that should not be on the wall.', chs.length > 1 ? `<select id="chSel" style="width:auto">${chs.map((c) => `<option value="${esc(c.id)}" ${c.id === id ? 'selected' : ''}>${esc(c.title)}</option>`).join('')}</select>` : '') +
    `<div class="photos">${r.photos.map((p, i) => `<div class="ph ${p.status === 'hidden' ? 'hidden' : ''}"><img data-i="${i}" alt="${esc(p.name)}"><div class="b"><div class="spread"><b>${esc(p.name)}</b>${p.status === 'checked' ? '<span class="tag gr">Checked</span>' : p.status === 'hidden' ? '<span class="tag">Hidden</span>' : ''}</div>
      <div class="small faint">${esc(fmtDay(p.day))} · ${esc(new Date(p.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))}</div>
      ${(p.comments || []).map((c) => `<div class="small" style="margin-top:6px"><b>${esc(c.name)}</b> ${esc(c.text)} <a href="#" data-cdel="${i}" data-at="${esc(c.at)}" class="faint">remove</a></div>`).join('')}
      <div class="row" style="margin-top:10px"><button class="btn sec sm" data-st="${i}" data-v="${p.status === 'checked' ? '' : 'checked'}">${p.status === 'checked' ? 'Uncheck' : 'Check'}</button><button class="btn sec sm" data-st="${i}" data-v="${p.status === 'hidden' ? '' : 'hidden'}">${p.status === 'hidden' ? 'Show' : 'Hide'}</button></div></div></div>`).join('') || '<div class="card empty" style="grid-column:1/-1">No photos this week.</div>'}</div>`;
  if ($('#chSel')) $('#chSel').onchange = (e) => { VIEWS.photos.ch = e.target.value; show('photos'); };
  // load the pictures a few at a time
  const imgs = [...main.querySelectorAll('img[data-i]')];
  (async () => { for (let k = 0; k < imgs.length; k += 4) await Promise.all(imgs.slice(k, k + 4).map(async (img) => { try { const d = await api('/admin/photo?key=' + encodeURIComponent(r.photos[img.dataset.i].key)); img.src = d.photo.startsWith('data:') ? d.photo : 'data:image/jpeg;base64,' + d.photo; } catch {} })); })();
  main.querySelectorAll('[data-st]').forEach((b) => (b.onclick = async () => { await api('/admin/photo-status', { method: 'POST', body: { key: r.photos[b.dataset.st].key, status: b.dataset.v } }); show('photos'); }));
  main.querySelectorAll('[data-cdel]').forEach((a) => (a.onclick = async (e) => { e.preventDefault(); if (!confirm('Remove this comment?')) return; await api('/admin/comment-delete', { method: 'POST', body: { key: r.photos[a.dataset.cdel].key, at: a.dataset.at } }); show('photos'); }));
};

// ═════ Challenges ═════
const COLORS = [['blue', 'Cyan'], ['orange', 'Orange'], ['purple', 'Purple'], ['green', 'Green'], ['pink', 'Pink'], ['yellow', 'Yellow']];
const CH_ICONS = [['trophy', 'Trophy'], ['tefillin', 'Tefillin'], ['flame', 'Flame'], ['star', 'Star'], ['book', 'Book'], ['heart', 'Heart'], ['sun', 'Sun'], ['gift', 'Gift'], ['camera', 'Camera'], ['music', 'Music'], ['ball', 'Ball']];
VIEWS.challenges = async (main) => {
  await loadContent();
  main.innerHTML = head('Challenges', 'Streak challenges teens join in the app. Rules and rewards show on each challenge page.', `<button class="btn" id="newCh">New challenge</button>`) +
    `<div class="grid g2">${content.challenges.map((c) => `<div class="card"><div class="spread"><h3>${esc(c.title)}</h3><span class="tag ${c.active ? 'gr' : ''}">${c.active ? 'Live' : 'Off'}</span></div>
      <p class="small muted" style="margin:6px 0 0">${esc(c.about)}</p><div class="small" style="margin-top:10px">Goal: ${c.goal} ${c.every === 'week' ? 'weeks' : 'days'}${c.photo ? ' · photo check-ins' : ''}${c.starts ? ' · starts ' + esc(fmtDay(c.starts)) : ''}</div>
      ${(c.rewards || []).map((r) => `<div class="small muted">${r.at} ${c.every === 'week' ? 'weeks' : 'days'}: ${esc(r.prize)}</div>`).join('')}
      <div class="row" style="margin-top:14px"><button class="btn sec sm" data-edit="${esc(c.id)}">Edit</button><button class="btn sec sm" data-tog="${esc(c.id)}">${c.active ? 'Turn off' : 'Turn on'}</button>${c.photo ? `<button class="btn sec sm" data-ph="${esc(c.id)}">Photos</button>` : ''}</div></div>`).join('') || '<div class="card empty">No challenges yet.</div>'}</div>`;
  $('#newCh').onclick = () => editChallenge(null);
  main.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => editChallenge(content.challenges.find((c) => c.id === b.dataset.edit))));
  main.querySelectorAll('[data-tog]').forEach((b) => (b.onclick = async () => { b.disabled = true; await saveContent({ ...content, challenges: content.challenges.map((c) => (c.id === b.dataset.tog ? { ...c, active: !c.active } : c)) }, 'Updated.'); show('challenges'); }));
  main.querySelectorAll('[data-ph]').forEach((b) => (b.onclick = () => { VIEWS.photos.ch = b.dataset.ph; show('photos'); }));
};
async function editChallenge(c) {
  const isNew = !c;
  c = c || { id: newId('c'), title: '', icon: 'trophy', color: 'blue', every: 'day', goal: 30, about: '', active: true, photo: true, starts: today(), rules: [], image: '', rewards: [] };
  const ok = await dialogLoop(isNew ? 'New challenge' : 'Edit ' + c.title,
    field('cTitle', 'Name', c.title, 'text', 'maxlength="60" placeholder="Like: Shabbat candles challenge"') + field('cAbout', 'About (one or two lines)', c.about, 'area', 'maxlength="400"') +
    `<div class="grid g3">${select('cEvery', 'Check in every', [['day', 'Day'], ['week', 'Week']], c.every)}${field('cGoal', 'Goal (how many)', c.goal, 'number', 'min="1" max="366"')}${field('cStarts', 'Starts on', c.starts || '', 'date')}</div>` +
    `<div class="grid g2">${select('cIcon', 'Icon', CH_ICONS, c.icon)}${select('cColor', 'Color', COLORS, c.color)}</div>` +
    check('cPhoto', 'Teens check in with a photo (shows on the photo wall)', c.photo) +
    field('cRules', 'Rules (one per line)', (c.rules || []).join('\n'), 'area') +
    field('cRewards', 'Rewards (one per line, like "30: Backpack")', (c.rewards || []).map((r) => r.at + ': ' + r.prize).join('\n'), 'area') +
    photoField('cImg', 'Rules page picture (optional)', c.image) +
    check('cActive', 'Live in the app', c.active),
    { ok: isNew ? 'Create challenge' : 'Save', danger: isNew ? '' : 'Delete', after: () => wirePhoto('cImg') },
    async () => {
      if (val('cTitle').length < 2) throw new Error('Name the challenge.');
      const rewards = val('cRewards').split('\n').filter((l) => l.trim()).map((l) => { const m = l.match(/^\s*(\d+)\s*[:\-]\s*(.+)$/); if (!m) throw new Error('Write each reward like "30: Backpack".'); return { at: Number(m[1]), prize: m[2].trim() }; });
      const image = await photoValue('cImg');
      const next = { ...c, title: val('cTitle'), about: val('cAbout'), every: val('cEvery'), goal: Number(val('cGoal')) || c.goal, starts: val('cStarts'), icon: val('cIcon'), color: val('cColor'), photo: val('cPhoto'), rules: val('cRules').split('\n').map((s) => s.trim()).filter(Boolean), rewards, image, active: val('cActive') };
      await saveContent({ ...content, challenges: isNew ? [...content.challenges, next] : content.challenges.map((x) => (x.id === c.id ? next : x)) }, isNew ? 'Challenge created. It shows in the app now.' : 'Saved.');
    },
    async () => { if (!confirm('Delete ' + c.title + '? Teens lose it from the app (their old photos stay on the server).')) throw new Error('Not deleted.'); await saveContent({ ...content, challenges: content.challenges.filter((x) => x.id !== c.id) }, 'Deleted.'); });
  if (ok && view === 'challenges') show('challenges');
}

// ═════ Chapter info ═════
const INFO_ICONS = [['pin', 'Pin'], ['users', 'People'], ['globe', 'Globe'], ['food', 'Food'], ['cap', 'Cap'], ['book', 'Book'], ['heart', 'Heart'], ['phone', 'Phone'], ['clock', 'Clock'], ['star', 'Star'], ['gift', 'Gift'], ['question', 'Question']];
VIEWS.info = async (main) => {
  await loadContent();
  const info = content.info || [];
  main.innerHTML = head('Chapter info', 'The rows on the Chapter tab. Use Up and Down to change the order.', `<button class="btn" id="newInfo">Add a row</button>`) +
    `<div class="card"><div class="list">${info.map((i, n) => `<div class="item"><div style="flex:1"><b>${esc(i.title)}</b><div class="small muted">${esc(i.body)}</div></div>
      <div class="row"><button class="btn sec sm" data-up="${n}" ${n ? '' : 'disabled'}>Up</button><button class="btn sec sm" data-down="${n}" ${n < info.length - 1 ? '' : 'disabled'}>Down</button><button class="btn sec sm" data-edit="${esc(i.id)}">Edit</button></div></div>`).join('') || '<div class="empty">No rows yet.</div>'}</div></div>`;
  const move = async (n, d) => { const list = [...info]; [list[n], list[n + d]] = [list[n + d], list[n]]; await saveContent({ ...content, info: list }, 'Order saved.'); show('info'); };
  main.querySelectorAll('[data-up]').forEach((b) => (b.onclick = () => move(Number(b.dataset.up), -1)));
  main.querySelectorAll('[data-down]').forEach((b) => (b.onclick = () => move(Number(b.dataset.down), 1)));
  main.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => editInfo(info.find((i) => i.id === b.dataset.edit))));
  $('#newInfo').onclick = () => editInfo(null);
};
async function editInfo(i) {
  const isNew = !i; i = i || { id: newId('i'), icon: 'pin', title: '', body: '' };
  const ok = await dialogLoop(isNew ? 'Add a row' : 'Edit row', field('fTitle', 'Title', i.title, 'text', 'maxlength="60"') + field('fBody', 'Text', i.body, 'area', 'maxlength="600"') + select('fIcon', 'Icon', INFO_ICONS, i.icon),
    { ok: 'Save', danger: isNew ? '' : 'Delete' },
    async () => { if (val('fTitle').length < 2) throw new Error('Add a title.'); const next = { ...i, title: val('fTitle'), body: val('fBody'), icon: val('fIcon') }; await saveContent({ ...content, info: isNew ? [...content.info, next] : content.info.map((x) => (x.id === i.id ? next : x)) }, 'Saved.'); },
    async () => { if (!confirm('Delete this row?')) throw new Error('Not deleted.'); await saveContent({ ...content, info: content.info.filter((x) => x.id !== i.id) }, 'Deleted.'); });
  if (ok && view === 'info') show('info');
}

// ═════ Minyan ═════
VIEWS.minyan = async (main) => {
  await loadContent();
  const m = content.minyan || { weekday: [], shabbat: [], note: '' };
  const rows = (k, list) => list.map((r, i) => `<div class="row" style="margin-top:8px"><input type="text" data-k="${k}" data-f="label" data-i="${i}" value="${esc(r.label)}" style="flex:2"><input type="text" data-k="${k}" data-f="time" data-i="${i}" value="${esc(r.time)}" style="flex:1"><button class="btn sec sm" type="button" data-rm="${k}:${i}">Remove</button></div>`).join('');
  const draw = () => {
    main.innerHTML = head('Minyan times', 'Shown on the Chapter tab.', `<button class="btn sec" id="aiM">Read a pasted schedule</button>`) +
      `<form class="card" id="mForm"><div class="grid g2"><div><h2>Shabbat</h2>${rows('shabbat', m.shabbat)}<button class="btn sec sm" type="button" data-add="shabbat" style="margin-top:10px">Add a time</button></div>
      <div><h2>Weekdays</h2>${rows('weekday', m.weekday)}<button class="btn sec sm" type="button" data-add="weekday" style="margin-top:10px">Add a time</button></div></div>
      ${field('mNote', 'Note', m.note, 'area', 'maxlength="300" style="min-height:60px"')}<div class="err" id="mErr"></div><button class="btn" style="margin-top:16px">Save times</button></form>`;
    main.querySelectorAll('input[data-k]').forEach((el) => (el.oninput = () => { m[el.dataset.k][el.dataset.i][el.dataset.f] = el.value; }));
    main.querySelectorAll('[data-add]').forEach((b) => (b.onclick = () => { m.note = val('mNote'); m[b.dataset.add].push({ label: '', time: '' }); draw(); }));
    main.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => { const [k, i] = b.dataset.rm.split(':'); m.note = val('mNote'); m[k].splice(Number(i), 1); draw(); }));
    $('#mForm').onsubmit = async (e) => { e.preventDefault(); try { await saveContent({ ...content, minyan: { weekday: m.weekday.filter((r) => r.label), shabbat: m.shabbat.filter((r) => r.label), note: val('mNote') } }, 'Times saved.'); } catch (err) { $('#mErr').textContent = err.message; } };
    $('#aiM').onclick = async () => {
      let out = null;
      const ok = await dialogLoop('Read a schedule', '<p class="muted">Paste the times from the shul email or website. The AI fills them in; check them, then save.</p>' + field('mText', 'Schedule', '', 'area', 'style="min-height:180px"'), { ok: 'Read it' },
        async () => { out = await api('/admin/minyan-from-text', { method: 'POST', body: { text: val('mText') } }); });
      if (ok && out && out.minyan) { Object.assign(m, out.minyan); draw(); toast('Filled in. Check the times, then save.'); }
    };
  };
  draw();
};

if (pass) signIn(pass).catch(() => signOut());
