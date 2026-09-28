// In-memory stand-in for Supabase (PostgREST + Auth + Storage + RPC) used by the e2e suite.
// Implements the subset of the REST/PostgREST grammar that this codebase uses.
// Run: node tests/mock-supabase.mjs [port]   (default 54321)
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { seed } from './seed.mjs';

const PORT = Number(process.argv[2] || process.env.MOCK_PORT || 54321);
const db = seed();                       // { table: [rows] }
const users = db.__users;                // [{ id, email, password, role, ... }]
const sessions = new Map();              // access_token -> user id
const FK = {                             // child.col -> parent table
  'applications.job_id': 'jobs', 'applications.candidate_id': 'profiles',
  'interviews.application_id': 'applications', 'conversations.participant_id': 'profiles',
  'client_requests.client_id': 'profiles', 'client_shortlist.request_id': 'client_requests', 'client_shortlist.candidate_id': 'profiles',
  'application_notes.application_id': 'applications', 'messages.conversation_id': 'conversations',
  'saved_jobs.job_id': 'jobs', 'saved_jobs.candidate_id': 'profiles', 'job_views.job_id': 'jobs',
  'posts.author_id': 'profiles', 'media.created_by': 'profiles', 'jobs.created_by': 'profiles',
};
const log = [];                          // rpc + storage calls, exposed at /__log for assertions

// ---------- helpers ----------
const json = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
};
const readBody = (req) => new Promise((resolve) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => resolve(Buffer.concat(c))); });
const now = () => new Date().toISOString();
const uuid = () => randomUUID();

/** Parses a PostgREST value: eq.open, in.(a,b), is.null, cs.{a,b}, ilike.%x% */
function matchFilter(row, col, spec) {
  const dot = spec.indexOf('.');
  let op = spec.slice(0, dot), val = spec.slice(dot + 1);
  let neg = false;
  if (op === 'not') { neg = true; const d2 = val.indexOf('.'); op = val.slice(0, d2); val = val.slice(d2 + 1); }
  const v = row[col];
  let r;
  switch (op) {
    case 'eq': r = String(v) === val; break;
    case 'neq': r = String(v) !== val; break;
    case 'gt': r = v > val; break;
    case 'gte': r = v >= val; break;
    case 'lt': r = v < val; break;
    case 'lte': r = v <= val; break;
    case 'is': r = val === 'null' ? v == null : val === 'true' ? v === true : v === false; break;
    case 'in': r = val.replace(/^\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, '')).includes(String(v)); break;
    case 'cs': { const arr = val.replace(/^\{|\}$/g, '').split(',').map((x) => x.replace(/^"|"$/g, '')).filter(Boolean); r = Array.isArray(v) && arr.every((x) => v.map(String).includes(x)); break; }
    case 'ilike': case 'like': { const re = new RegExp('^' + val.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', op === 'ilike' ? 'i' : ''); r = re.test(String(v ?? '')); break; }
    default: r = true;
  }
  return neg ? !r : r;
}
/** or=(a.eq.1,b.ilike.%x%) */
function matchOr(row, expr) {
  const inner = expr.replace(/^\(|\)$/g, '');
  const parts = []; let depth = 0, cur = '';
  for (const ch of inner) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch; }
  if (cur) parts.push(cur);
  return parts.some((p) => { const i = p.indexOf('.'); return matchFilter(row, p.slice(0, i), p.slice(i + 1)); });
}

/** select=a,b,rel(c,d),rel2(count) → tree */
function parseSelect(sel) {
  const out = []; let i = 0;
  const readName = () => { let s = ''; while (i < sel.length && !/[,()]/.test(sel[i])) s += sel[i++]; return s.trim(); };
  const parseList = () => {
    const items = [];
    while (i < sel.length) {
      const name = readName();
      if (sel[i] === '(') { i++; const children = parseList(); items.push({ name: name.replace(/!.*$/, ''), children }); }
      else if (name) items.push({ name });
      if (sel[i] === ',') { i++; continue; }
      if (sel[i] === ')') { i++; return items; }
    }
    return items;
  };
  return parseList();
}
function embed(table, row, node) {
  const child = node.name;
  const fkFwd = FK[`${table}.${child}_id`] || (Object.entries(FK).find(([k, v]) => k.startsWith(table + '.') && v === child)?.[1] && child);
  const fwdCol = Object.keys(FK).find((k) => k.startsWith(table + '.') && FK[k] === child)?.split('.')[1];
  if (fwdCol) { // many-to-one
    const parent = (db[child] || []).find((r) => r.id === row[fwdCol]);
    return parent ? project(child, parent, node.children) : null;
  }
  // one-to-many: child rows whose FK points at this row
  const backCol = Object.keys(FK).find((k) => k.startsWith(child + '.') && FK[k] === table)?.split('.')[1];
  const rows = backCol ? (db[child] || []).filter((r) => r[backCol] === row.id) : [];
  if (node.children.length === 1 && node.children[0].name === 'count') return [{ count: rows.length }];
  return rows.map((r) => project(child, r, node.children));
}
function project(table, row, nodes) {
  if (!nodes || nodes.length === 0 || (nodes.length === 1 && nodes[0].name === '*')) return { ...row };
  const out = {};
  for (const n of nodes) {
    if (n.name === '*') Object.assign(out, row);
    else if (n.children) out[n.name] = embed(table, row, n);
    else out[n.name] = row[n.name];
  }
  return out;
}

const STAFF = ['admin', 'recruiter', 'editor', 'support', 'viewer'];
/** Row-level security emulation for non-staff users (mirrors docs/migration-*.sql policies). */
function rls(table, rows, user) {
  const prof = user ? db.profiles.find((p) => p.id === user.id) : null;
  const role = prof?.role ?? null;
  if (role && STAFF.includes(role)) return rows;
  const uid = user?.id ?? null;
  switch (table) {
    case 'applications': return rows.filter((r) => r.candidate_id === uid);
    case 'saved_jobs': return rows.filter((r) => r.candidate_id === uid);
    case 'application_notes': return [];
    case 'interviews': return rows.filter((r) => db.applications.find((a) => a.id === r.application_id)?.candidate_id === uid);
    case 'client_requests': return rows.filter((r) => r.client_id === uid);
    case 'client_shortlist': return rows.filter((r) => r.admin_status === 'sent' && db.client_requests.find((q) => q.id === r.request_id)?.client_id === uid);
    case 'conversations': return rows.filter((r) => r.participant_id === uid);
    case 'messages': return rows.filter((r) => db.conversations.find((c) => c.id === r.conversation_id)?.participant_id === uid);
    case 'profiles': return rows.filter((r) => r.id === uid);
    case 'jobs': return rows.filter((r) => r.status === 'open');
    case 'posts': case 'pages': return rows.filter((r) => r.status === 'published');
    case 'audit_log': case 'events': case 'contact_messages': case 'job_views': return [];
    default: return rows;
  }
}

function applyQuery(table, rows, q, user) {
  let list = rls(table, rows, user).filter((row) => {
    for (const [k, v] of q.entries()) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
      if (k === 'or') { if (!matchOr(row, v)) return false; continue; }
      if (!matchFilter(row, k, v)) return false;
    }
    return true;
  });
  const order = q.get('order');
  if (order) {
    for (const part of order.split(',').reverse()) {
      const [col, ...opts] = part.split('.');
      const desc = opts.includes('desc');
      const nullsFirst = opts.includes('nullsfirst');
      list = [...list].sort((a, b) => {
        const x = a[col], y = b[col];
        if (x == null && y == null) return 0;
        if (x == null) return nullsFirst ? -1 : 1;
        if (y == null) return nullsFirst ? 1 : -1;
        return (x < y ? -1 : x > y ? 1 : 0) * (desc ? -1 : 1);
      });
    }
  }
  const total = list.length;
  const offset = Number(q.get('offset') || 0), limit = q.get('limit') ? Number(q.get('limit')) : Infinity;
  list = list.slice(offset, offset + limit);
  return { list, total };
}

// ---------- RPC ----------
const rpc = {
  track_event: (a) => { db.events.push({ id: db.events.length + 1, kind: a.kind, path: a.path, ref: a.ref, device: a.device ?? null, utm_source: a.utm_source ?? null, utm_medium: a.utm_medium ?? null, utm_campaign: a.utm_campaign ?? null, day: now().slice(0, 10), created_at: now() }); return null; },
  bump_job_view: (a) => { const day = now().slice(0, 10); const r = db.job_views.find((x) => x.job_id === a.job && x.day === day); if (r) r.count++; else db.job_views.push({ job_id: a.job, day, count: 1 }); return null; },
  jd_download: (a) => { const t = db.jd_templates.find((x) => x.slug === a.t_slug); if (t) t.downloads++; return null; },
  submit_contact: (a) => { db.contact_messages.push({ id: uuid(), name: a.p_name, email: a.p_email, message: a.p_message, company: a.p_company, phone: a.p_phone, service: a.p_service, source: a.p_source, status: 'new', note: null, created_at: now() }); return null; },
  client_decide_shortlist: (a, user) => { const it = db.client_shortlist.find((x) => x.id === a.item); if (!it) return null; const req = db.client_requests.find((r) => r.id === it.request_id); if (req && user && req.client_id !== user.id) throw new Error('forbidden'); it.client_decision = a.decision; it.client_note = a.note; it.decided_at = now(); return null; },
};

// ---------- server ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const path = url.pathname;
  const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readBody(req) : Buffer.alloc(0);
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  const user = sessions.has(token) ? users.find((u) => u.id === sessions.get(token)) : null;
  const prefer = String(req.headers.prefer || '');
  if (req.method === 'OPTIONS') return json(res, 204);

  try {
    // ---- debug
    if (path === '/__log') return json(res, 200, log);
    if (path === '/__db') return json(res, 200, Object.fromEntries(Object.entries(db).filter(([k]) => !k.startsWith('__'))));
    if (path === '/__reset') { Object.assign(db, seed()); sessions.clear(); log.length = 0; return json(res, 200, { ok: true }); }

    // ---- auth
    if (path.startsWith('/auth/v1/')) {
      const sub = path.slice('/auth/v1/'.length);
      const b = body.length ? JSON.parse(body.toString()) : {};
      const mkSession = (u) => { const t = 'tok_' + uuid(); sessions.set(t, u.id); return { access_token: t, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r_' + t, user: pubUser(u) }; };
      const pubUser = (u) => ({ id: u.id, email: u.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: u.meta || {}, created_at: u.created_at });
      if (sub === 'token' && req.method === 'POST') {
        if (url.searchParams.get('grant_type') === 'refresh_token') { const uid = [...sessions.entries()].find(([t]) => 'r_' + t === b.refresh_token)?.[1]; const u = users.find((x) => x.id === uid); return u ? json(res, 200, mkSession(u)) : json(res, 400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' }); }
        const u = users.find((x) => x.email === String(b.email).toLowerCase() && x.password === b.password);
        return u ? json(res, 200, mkSession(u)) : json(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', error_code: 'invalid_credentials' });
      }
      if (sub === 'signup' && req.method === 'POST') {
        if (users.some((x) => x.email === String(b.email).toLowerCase())) return json(res, 422, { code: 422, msg: 'User already registered', error_code: 'user_already_exists' });
        const u = { id: uuid(), email: String(b.email).toLowerCase(), password: b.password, meta: b.data || {}, created_at: now() };
        users.push(u);
        db.profiles.push({ id: u.id, role: u.meta.role || 'candidate', full_name: u.meta.full_name ?? null, phone: u.meta.phone ?? null, company_name: u.meta.company_name ?? null, email: u.email, skills: [], tags: [], created_at: now() });
        return json(res, 200, mkSession(u)); // auto-confirm: returns a session like a project with confirmations off
      }
      if (sub === 'user' && req.method === 'GET') return user ? json(res, 200, pubUser(user)) : json(res, 401, { code: 401, msg: 'invalid claim: missing sub claim' });
      if (sub === 'logout') { sessions.delete(token); return json(res, 204); }
      return json(res, 404, { msg: 'auth route not mocked: ' + sub });
    }

    // ---- storage
    if (path.startsWith('/storage/v1/')) {
      const sub = path.slice('/storage/v1/'.length);
      if (sub.startsWith('object/sign/')) { const p = sub.slice('object/sign/'.length); log.push({ storage: 'sign', path: p }); return json(res, 200, { signedURL: `/storage/v1/object/sign/${p}?token=x` }); }
      if (sub.startsWith('object/') && req.method === 'POST') { const p = sub.slice('object/'.length); log.push({ storage: 'upload', path: p, size: body.length, type: req.headers['content-type'] }); return json(res, 200, { Key: p, Id: uuid() }); }
      if (sub.startsWith('object/') && req.method === 'DELETE') { log.push({ storage: 'remove', body: body.toString() }); return json(res, 200, []); }
      if (sub.startsWith('object/') && req.method === 'GET') { res.writeHead(200, { 'content-type': 'application/pdf' }); return res.end('%PDF-1.4 mock'); }
      return json(res, 404, { message: 'storage route not mocked' });
    }

    // ---- rest
    if (path.startsWith('/rest/v1/')) {
      const name = path.slice('/rest/v1/'.length);
      if (name.startsWith('rpc/')) {
        const fn = name.slice(4); const args = body.length ? JSON.parse(body.toString()) : {};
        log.push({ rpc: fn, args, user: user?.id ?? null });
        if (!rpc[fn]) return json(res, 404, { message: `function ${fn} not mocked` });
        try { return json(res, 200, rpc[fn](args, user)); } catch (e) { return json(res, 400, { message: e.message }); }
      }
      const table = name;
      if (!db[table]) return json(res, 404, { message: `relation "public.${table}" does not exist`, code: '42P01' });
      const q = url.searchParams;
      const selNodes = parseSelect(q.get('select') || '*');
      const wantRep = /return=representation/.test(prefer);
      const single = /vnd\.pgrst\.object/.test(String(req.headers.accept || ''));
      const finish = (rows) => {
        const out = rows.map((r) => project(table, r, selNodes));
        if (single) { if (out.length !== 1) return json(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `Results contain ${out.length} rows` }); return json(res, 200, out[0]); }
        return json(res, 200, out);
      };

      if (req.method === 'GET' || req.method === 'HEAD') {
        const { list, total } = applyQuery(table, db[table], q, user);
        const headers = /count=exact/.test(prefer) ? { 'content-range': `${list.length ? 0 : '*'}-${list.length ? list.length - 1 : '*'}/${total}` } : {};
        if (req.method === 'HEAD') { res.writeHead(200, headers); return res.end(); }
        const out = list.map((r) => project(table, r, selNodes));
        if (single) { if (out.length === 0) return json(res, 200, null, headers); if (out.length > 1) return json(res, 406, { code: 'PGRST116', message: 'multiple rows' }); return json(res, 200, out[0], headers); }
        return json(res, 200, out, headers);
      }
      if (req.method === 'POST') {
        const data = JSON.parse(body.toString() || '[]'); const rows = Array.isArray(data) ? data : [data];
        const upsert = /resolution=merge-duplicates/.test(prefer) || /resolution=ignore-duplicates/.test(prefer);
        const ignore = /resolution=ignore-duplicates/.test(prefer);
        const conflict = (q.get('on_conflict') || 'id').split(',');
        const inserted = [];
        for (const r of rows) {
          // unique checks used by the app
          if (table === 'jobs' && db.jobs.some((x) => x.slug === r.slug) && !upsert) return json(res, 409, { code: '23505', message: 'duplicate key value violates unique constraint "jobs_slug_key"' });
          if (table === 'posts' && db.posts.some((x) => x.slug === r.slug) && !upsert) return json(res, 409, { code: '23505', message: 'duplicate key' });
          if (table === 'pages' && db.pages.some((x) => x.slug === r.slug) && !upsert) return json(res, 409, { code: '23505', message: 'duplicate key' });
          if (table === 'applications' && db.applications.some((x) => x.job_id === r.job_id && x.candidate_id === r.candidate_id)) return json(res, 409, { code: '23505', message: 'duplicate key value violates unique constraint' });
          if (table === 'saved_jobs' && db.saved_jobs.some((x) => x.job_id === r.job_id && x.candidate_id === r.candidate_id)) { if (!ignore && !upsert) return json(res, 409, { code: '23505', message: 'duplicate' }); continue; }
          const existing = upsert ? db[table].find((x) => conflict.every((c) => x[c] === r[c])) : null;
          if (existing) { if (!ignore) Object.assign(existing, r); inserted.push(existing); continue; }
          const row = { id: uuid(), created_at: now(), ...defaults(table), ...r };
          db[table].push(row); inserted.push(row);
        }
        log.push({ insert: table, n: inserted.length });
        if (!wantRep) { res.writeHead(201); return res.end(); }
        res.statusCode = 201; return finish(inserted);
      }
      if (req.method === 'PATCH') {
        const patch = JSON.parse(body.toString() || '{}');
        const { list } = applyQuery(table, db[table], q, user);
        for (const r of list) Object.assign(r, patch);
        log.push({ update: table, n: list.length, patch });
        if (!wantRep) { res.writeHead(204); return res.end(); }
        return finish(list);
      }
      if (req.method === 'DELETE') {
        const { list } = applyQuery(table, db[table], q, user);
        db[table] = db[table].filter((r) => !list.includes(r));
        log.push({ delete: table, n: list.length });
        if (!wantRep) { res.writeHead(204); return res.end(); }
        return finish(list);
      }
    }
    json(res, 404, { message: 'not mocked: ' + req.method + ' ' + path });
  } catch (e) {
    console.error('[mock]', req.method, path, e);
    json(res, 500, { message: String(e) });
  }
});

function defaults(table) {
  switch (table) {
    case 'jobs': return { status: 'draft', salary_currency: 'EGP', salary_visible: false, skills: [], published_at: null, apply_url: null, requirements_md: '' };
    case 'applications': return { status: 'submitted', rating: null, cover_note: null, cv_path: null };
    case 'posts': return { status: 'draft', body_md: '', body_html: '', excerpt: '', tags: [], cover_path: null, category: null, author_name: null, published_at: null, updated_at: now() };
    case 'pages': return { status: 'draft', body_html: '', description: '', updated_at: now() };
    case 'client_requests': return { status: 'new', details_md: '' };
    case 'client_shortlist': return { admin_status: 'draft', client_decision: 'pending', client_note: null, position: 0, summary: '' };
    case 'interviews': return { status: 'confirmed', location: null, notes: null };
    case 'conversations': return { subject: 'محادثة', last_message_at: now() };
    case 'testimonials': case 'faqs': case 'pricing_plans': case 'guide_sections': return { published: true, position: 0 };
    case 'site_sections': return { published: true, position: 0, items: [], body_html: '', reverse: false };
    case 'jd_templates': return { published: true, position: 0, downloads: 0, summary: '', body_html: '' };
    case 'media': return { alt: '' };
    case 'audit_log': return {};
    default: return {};
  }
}

server.listen(PORT, () => console.log(`[mock-supabase] listening on http://localhost:${PORT}`));
