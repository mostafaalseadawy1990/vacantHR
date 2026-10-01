// End-to-end scenarios against `astro dev` + the in-memory Supabase mock (tests/mock-supabase.mjs).
// Run: npm run test:e2e   (starts both servers, runs every scenario, prints a summary, exits 1 on failures)
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import { IDS } from './seed.mjs';

const MOCK = 54321, APP = 4399;
const BASE = `http://localhost:${APP}`;
const MOCK_URL = `http://localhost:${MOCK}`;
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(url, tries = 60) { for (let i = 0; i < tries; i++) { try { const r = await fetch(url); if (r.status < 500) return; } catch {} await wait(1000); } throw new Error('timeout waiting ' + url); }
const mockDb = async () => (await fetch(MOCK_URL + '/__db')).json();
const mockLog = async () => (await fetch(MOCK_URL + '/__log')).json();
const reset = async () => fetch(MOCK_URL + '/__reset');

// ---------- tiny test harness ----------
const results = [];
let browser;
async function scenario(name, fn) {
  const ctx = await browser.newContext({ baseURL: BASE, locale: 'ar-EG' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const t0 = Date.now();
  try {
    await fn({ page, ctx, req: ctx.request });
    if (errors.length) throw new Error(errors.join(' | '));
    results.push({ name, ok: true, ms: Date.now() - t0 }); process.stdout.write(`  ✓ ${name}\n`);
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - t0, err: e.message }); process.stdout.write(`  ✗ ${name}\n      ${e.message.split('\n').slice(0, 12).join('\n      ')}\n`);
  } finally { await ctx.close(); }
}
function expect(cond, msg) { if (!cond) throw new Error('expect failed: ' + msg); }
const eq = (a, b, msg) => expect(a === b, `${msg}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
const includes = (s, sub, msg) => expect(String(s).includes(sub), `${msg}: "${sub}" not found`);

async function login(page, email, password = 'Passw0rd!') {
  await page.goto('/login');
  await page.fill('input[name=email]', email); await page.fill('input[name=password]', password);
  await Promise.all([page.waitForNavigation(), page.click('button[type=submit]')]);
}
/** GET without following redirects → { status, location, text } */
async function get(req, path) { const r = await req.get(path, { maxRedirects: 0 }); return { status: r.status(), location: r.headers()['location'] || '', text: r.status() < 300 ? await r.text() : '', headers: r.headers() }; }
async function post(req, path, form) { const r = await req.post(path, { form, maxRedirects: 0 }); return { status: r.status(), location: r.headers()['location'] || '', text: r.status() < 300 ? await r.text() : '' }; }
async function postMultipart(req, path, multipart) { const r = await req.post(path, { multipart, maxRedirects: 0 }); return { status: r.status(), location: r.headers()['location'] || '', text: r.status() < 300 ? await r.text() : '' }; }

// ---------- scenarios ----------
const scenarios = [];
const S = (name, fn) => scenarios.push([name, fn]);

// ===== Public site =====
S('public: core pages render and unknown routes 404', async ({ req }) => {
  for (const p of ['/', '/recruitment', '/hrm-saas', '/consulting', '/about', '/contact', '/careers', '/blog', '/jd-templates', '/hrm-guide', '/privacy', '/login', '/signup', '/services']) {
    const r = await get(req, p); eq(r.status, 200, `GET ${p}`);
  }
  eq((await get(req, '/no-such-page')).status, 404, '404 page');
  eq((await get(req, '/careers/draft-role')).status, 404, 'draft job hidden');
  eq((await get(req, '/careers/closed-role')).status, 404, 'closed job hidden');
  eq((await get(req, '/blog/draft-post')).status, 404, 'draft post hidden');
  const sm = await get(req, '/sitemap.xml'); eq(sm.status, 200, 'sitemap');
  includes(sm.text, '/careers/backend-developer-cairo', 'sitemap has open job'); includes(sm.text, '/blog/how-to-hire', 'sitemap has post'); includes(sm.text, '/services', 'sitemap has cms page');
  expect(!sm.text.includes('draft-role'), 'sitemap excludes draft job');
  includes((await get(req, '/robots.txt')).text, 'Disallow: /admin', 'robots');
  eq((await get(req, '/rss.xml')).status, 200, 'rss');
});

S('public: canonical host + charset header', async ({ req }) => {
  const r = await req.get('/about', { headers: { host: 'www.vacanthr.com' }, maxRedirects: 0 });
  eq(r.status(), 301, 'www redirects'); eq(r.headers()['location'], 'https://vacanthr.com/about', 'www → apex');
  const h = await req.get('/about', { maxRedirects: 0 }); includes(h.headers()['content-type'] || '', 'charset=utf-8', 'charset in header');
});

S('public: careers list, filters and search', async ({ page, req }) => {
  await page.goto('/careers');
  const titles = await page.locator('.job-card h2').allTextContents();
  eq(titles.length, 4, 'open jobs count'); expect(!titles.join().includes('مسودة'), 'no draft');
  await page.goto('/careers?dept=' + encodeURIComponent('المالية'));
  eq((await page.locator('.job-card').count()), 1, 'dept filter');
  await page.goto('/careers?q=Backend'); eq(await page.locator('.job-card').count(), 1, 'search');
  await page.goto('/careers?workplace=onsite'); eq(await page.locator('.job-card').count(), 1, 'workplace filter');
  includes((await get(req, '/careers')).text, 'اعمل حساب مجانًا', 'guest CTA visible');
});

S('public: job page (guest, external apply, similar jobs)', async ({ page }) => {
  await page.goto('/careers/backend-developer-cairo');
  includes(await page.locator('h1').textContent(), 'Backend Developer', 'title');
  const apply = page.locator('.job-apply-card a.btn.solid').first();
  includes(await apply.getAttribute('href'), '/login?next=', 'guest apply goes to login');
  expect((await page.locator('.job-similar .job-sim').count()) >= 1, 'similar jobs');
  expect((await page.locator('.job-skills span').count()) === 3, 'skills chips');
  await page.goto('/careers/external-apply-role');
  const ext = page.locator('.job-apply-card a.btn.solid').first();
  includes(await ext.getAttribute('href'), 'forms.gle', 'external link'); eq(await ext.getAttribute('target'), '_blank', 'external target');
});

S('public: blog index, category filter, post, related', async ({ page }) => {
  await page.goto('/blog');
  eq(await page.locator('.post-card, .post-feat').count(), 1, 'one published post (featured)');
  await page.goto('/blog?cat=' + encodeURIComponent('توظيف')); expect((await page.locator('.post-card, .post-feat').count()) === 1, 'category filter');
  await page.goto('/blog?cat=' + encodeURIComponent('غير-موجود')); includes(await page.textContent('main'), 'لسه مفيش مقالات', 'empty category');
  await page.goto('/blog/how-to-hire'); includes(await page.textContent('article'), 'نص المقال', 'post body'); includes(await page.textContent('article'), 'دقائق قراءة', 'read time');
});

S('public: JD templates list, preview, Word download', async ({ page, req }) => {
  await page.goto('/jd-templates');
  eq(await page.locator('.doc-card').count(), 6, 'six default templates');
  await page.goto('/jd-templates?sector=' + encodeURIComponent('المالية')); eq(await page.locator('.doc-card').count(), 1, 'sector filter');
  eq((await get(req, '/jd-templates/jd-senior-accountant')).status, 200, 'preview page');
  const r = await req.get('/jd-templates/jd-senior-accountant.docx');
  eq(r.status(), 200, 'docx status'); includes(r.headers()['content-type'], 'wordprocessingml', 'docx mime');
  const buf = await r.body(); eq(buf.slice(0, 2).toString(), 'PK', 'docx is a zip');
  eq((await get(req, '/jd-templates/nope.docx')).status, 404, 'unknown template');
  expect((await mockLog()).some((l) => l.rpc === 'jd_download'), 'download counter rpc');
});

S('public: contact form validation, honeypot, success', async ({ page, req }) => {
  const before = (await mockDb()).contact_messages.length;
  let r = await post(req, '/contact', { name: 'x', email: 'bad', message: 'short' });
  eq(r.status, 200, 'invalid stays on page'); includes(r.text, 'بريد إلكتروني صحيح', 'validation message');
  r = await post(req, '/contact', { name: 'Bot', email: 'bot@x.com', message: 'spam spam spam spam', website: 'http://spam' });
  eq(r.status, 303, 'honeypot redirects'); eq(r.location, '/thanks', 'honeypot → thanks'); eq((await mockDb()).contact_messages.length, before, 'honeypot not stored');
  await page.goto('/contact');
  await page.fill('#name', 'زائر جديد'); await page.fill('#email', 'new@visitor.com'); await page.fill('#message', 'محتاج توظيف 3 أشخاص للمبيعات');
  await Promise.all([page.waitForNavigation(), page.click('form.form-box button[type=submit]')]);
  includes(page.url(), '/thanks', 'success → thanks');
  const msgs = (await mockDb()).contact_messages; eq(msgs.length, before + 1, 'stored'); eq(msgs.at(-1).email, 'new@visitor.com', 'stored email');
});

S('public: pageview tracking + job view counter', async ({ page }) => {
  await page.goto('/about'); await wait(500);
  const log = await mockLog();
  expect(log.some((l) => l.rpc === 'track_event' && l.args.path === '/about'), 'track_event called');
  await page.goto('/careers/senior-accountant'); await wait(500);
  expect((await mockLog()).some((l) => l.rpc === 'bump_job_view'), 'bump_job_view called');
});

// ===== Candidate =====
S('candidate: signup creates profile and lands on dashboard', async ({ page }) => {
  await page.goto('/signup');
  await page.fill('input[name=full_name]', 'مرشح جديد'); await page.fill('input[name=email]', 'newcand@test.com'); await page.fill('input[name=password]', 'Passw0rd!');
  await Promise.all([page.waitForNavigation(), page.click('button[type=submit]')]);
  includes(page.url(), '/dashboard', 'redirected to dashboard'); includes(page.url(), 'registered=1', 'registration flag');
  const p = (await mockDb()).profiles.find((x) => x.email === 'newcand@test.com'); expect(p && p.role === 'candidate', 'profile created as candidate');
  eq((await post(page.context().request, '/signup', { full_name: 'x', email: 'cand@test.com', password: 'Passw0rd!', role: 'candidate' })).status, 302, 'signed-in user is redirected away from signup');
});

S('candidate: dashboard, applications, interviews, saved', async ({ page, req }) => {
  await login(page, 'cand@test.com');
  includes(page.url(), '/dashboard', 'login lands on dashboard');
  const tiles = await page.locator('.ptile b').allTextContents();
  eq(tiles[0], '1', 'applications tile'); eq(tiles[1], '1', 'interviews tile'); eq(tiles[2], '1', 'saved tile');
  includes(await page.textContent('main'), 'وظائف تناسب مهاراتك', 'suggestions section');
  await page.goto('/dashboard/applications'); includes(await page.textContent('main'), 'قائمة مختصرة', 'status shown');
  await page.goto('/dashboard/interviews'); includes(await page.textContent('main'), 'أضف للتقويم', 'calendar link');
  await page.goto('/dashboard/saved'); includes(await page.textContent('main'), 'أخصائي تسويق رقمي', 'saved job');
  eq((await get(req, '/admin')).status, 302, 'candidate blocked from admin');
  eq((await get(req, '/dashboard/requests')).status, 302, 'candidate blocked from client page');
});

S('candidate: apply with CV, duplicate apply, external apply', async ({ page, req }) => {
  await login(page, 'cand@test.com');
  await page.goto('/careers/senior-accountant');
  includes(await page.locator('.job-apply-card a.btn.solid').first().getAttribute('href'), '/apply', 'apply link when logged in');
  let r = await postMultipart(req, '/careers/senior-accountant/apply', { cover_note: 'مهتم', cv: { name: 'cv.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') } });
  eq(r.status, 303, 'apply redirects'); includes(r.location, '/dashboard?applied=1', 'applied flag');
  const apps = (await mockDb()).applications.filter((a) => a.candidate_id === IDS.candidate); eq(apps.length, 2, 'application stored');
  expect((await mockLog()).some((l) => l.storage === 'upload' && l.path.includes('cvs/')), 'cv uploaded');
  r = await get(req, '/careers/senior-accountant/apply'); eq(r.status, 302, 'second apply bounces'); includes(r.location, 'applied=1', 'to dashboard');
  r = await postMultipart(req, '/careers/digital-marketing-specialist/apply', { cv: { name: 'cv.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('x') } });
  eq(r.status, 200, 'bad file type stays'); includes(r.text, 'الصيغة غير مدعومة', 'file type error');
  r = await get(req, '/careers/external-apply-role/apply'); eq(r.status, 302, 'external apply redirects'); includes(r.location, 'forms.gle', 'to external');
});

S('candidate: profile update + completeness + save/unsave job', async ({ page, req }) => {
  await login(page, 'cand2@test.com');
  await page.goto('/dashboard/profile');
  const before = await page.textContent('main'); includes(before, 'اكتمال ملفك', 'completeness meter');
  await page.fill('#full_name', 'سارة المرشحة'); await page.fill('#phone', '01011112222'); await page.fill('#headline', 'محاسبة'); await page.fill('#city', 'الجيزة');
  await page.fill('#years_experience', '3'); await page.fill('#education', 'بكالوريوس تجارة'); await page.selectOption('#availability', '1month'); await page.fill('#skills', 'Excel, SAP, ضرائب'); await page.fill('#bio', 'نبذة قصيرة');
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }).catch(() => {}), page.click('form.form-box button[type=submit]')]);
  includes(await page.textContent('main'), 'اتحفظت التعديلات', 'saved');
  const p = (await mockDb()).profiles.find((x) => x.id === IDS.candidate2); eq(p.city, 'الجيزة', 'city saved'); eq(p.availability, '1month', 'availability saved'); eq(p.skills.length, 3, 'skills parsed');
  includes(await page.textContent('main'), '90%', 'completeness after fill (no CV)');
  let r = await req.post('/careers/backend-developer-cairo/save', { data: { action: 'save' } }); eq(r.status(), 200, 'save job');
  expect((await mockDb()).saved_jobs.some((s) => s.candidate_id === IDS.candidate2), 'saved row');
  r = await req.post('/careers/backend-developer-cairo/save', { data: { action: 'unsave' } }); eq(r.status(), 200, 'unsave');
  expect(!(await mockDb()).saved_jobs.some((s) => s.candidate_id === IDS.candidate2), 'unsaved row');
});

// ===== Client =====
S('client: overview, new request, approve candidate', async ({ page, req }) => {
  await login(page, 'client@test.com');
  const tiles = await page.locator('.ptile b').allTextContents(); eq(tiles[1], '1', 'pending decisions tile');
  await page.goto('/dashboard/requests');
  eq(await page.locator('.citem').count(), 1, 'one request');
  includes(await page.textContent('main'), 'مرشح أول', 'sent candidate visible'); expect(!(await page.textContent('main')).includes('مرشح مسودة'), 'draft candidate hidden');
  let r = await post(req, '/dashboard/requests', { _action: 'new_request', role_title: 'مدير تسويق', headcount: '1', details_md: 'خبرة 5 سنوات' });
  eq(r.status, 303, 'request created'); includes(r.location, 'sent=1', 'sent flag');
  eq((await mockDb()).client_requests.length, 2, 'stored');
  r = await post(req, '/dashboard/requests', { _action: 'decide', item_id: IDS.sl1, decision: 'approved' });
  eq(r.status, 303, 'decision posted');
  const it = (await mockDb()).client_shortlist.find((x) => x.id === IDS.sl1); eq(it.client_decision, 'approved', 'decision stored via rpc');
  eq((await post(req, '/dashboard/requests', { _action: 'new_request', role_title: '' })).status, 200, 'empty title rejected');
  eq((await get(req, '/dashboard/applications')).status, 302, 'client blocked from candidate pages');
});

// ===== Admin =====
S('admin: overview + sidebar + analytics periods', async ({ page, req }) => {
  await login(page, 'admin@test.com');
  await page.goto('/admin');
  includes(await page.textContent('.adm-title'), 'Admin', 'greeting with name');
  const nav = await page.locator('.adm-nav a span').allTextContents();
  for (const l of ['الوظائف', 'المرشحون', 'رسائل الموقع', 'المدوّنة', 'الصفحات', 'المحتوى', 'التحليلات', 'الفريق', 'سجل النشاط']) includes(nav.join('|'), l, 'sidebar has ' + l);
  includes(await page.textContent('main'), 'محتاج انتباهك', 'attention box');
  for (const p of [7, 30, 90]) { const r = await get(req, `/admin/analytics?p=${p}`); eq(r.status, 200, 'analytics ' + p); includes(r.text, 'قمع التوظيف', 'funnel'); }
  const t = await get(req, '/admin/analytics?p=today'); eq(t.status, 200, 'analytics today'); includes(t.text, 'بالساعة', 'hourly chart'); includes(t.text, '21:00', 'hour ticks');
  const yd = await get(req, '/admin/analytics?p=yesterday'); eq(yd.status, 200, 'analytics yesterday'); includes(yd.text, 'مقارنة باليوم اللي قبله', 'yesterday label');
});

S('admin: jobs list, create, duplicate slug, edit, status change, board', async ({ page, req }) => {
  await login(page, 'admin@test.com');
  await page.goto('/admin/jobs'); eq(await page.locator('.jobs-table tbody tr').count(), 6, 'all jobs');
  await page.goto('/admin/jobs?status=draft'); eq(await page.locator('.jobs-table tbody tr').count(), 1, 'draft filter');
  let r = await post(req, '/admin/jobs/new', { title: 'QA Engineer', slug: 'qa-engineer', department: 'التقنية', employment_type: 'full_time', workplace: 'remote', description_md: 'وصف', status: 'open', skills: 'Testing, Cypress', apply_url: '' });
  eq(r.status, 303, 'job created'); includes(r.location, '/admin/jobs/qa-engineer', 'redirect to job');
  const j = (await mockDb()).jobs.find((x) => x.slug === 'qa-engineer'); eq(j.status, 'open', 'status'); eq(j.skills.length, 2, 'skills'); expect(!!j.published_at, 'published_at set');
  r = await post(req, '/admin/jobs/new', { title: 'Dup', slug: 'qa-engineer', description_md: 'x', status: 'draft' }); eq(r.status, 200, 'dup stays'); includes(r.text, 'مستخدم قبل كده', 'dup error');
  r = await post(req, '/admin/jobs/new', { title: 'Bad url', slug: 'bad-url', description_md: 'x', status: 'draft', apply_url: 'javascript:alert(1)' }); includes(r.text, 'رابط التقديم الخارجي مش صحيح', 'apply url validated');
  r = await post(req, '/admin/jobs/qa-engineer', { _action: 'save_job', title: 'QA Engineer II', employment_type: 'full_time', workplace: 'remote', description_md: 'وصف', status: 'open', apply_url: 'forms.gle/abc', skills: '' });
  eq(r.status, 303, 'job saved'); eq((await mockDb()).jobs.find((x) => x.slug === 'qa-engineer').apply_url, 'https://forms.gle/abc', 'apply url normalised');
  r = await post(req, '/admin/jobs', { id: j.id, status: 'closed' }); eq(r.status, 303, 'status change'); eq((await mockDb()).jobs.find((x) => x.slug === 'qa-engineer').status, 'closed', 'closed');
  eq((await get(req, '/careers/qa-engineer')).status, 404, 'closed job 404 publicly');
  eq((await get(req, '/admin/jobs/backend-developer-cairo/board')).status, 200, 'kanban');
  expect((await mockDb()).audit_log.some((a) => a.action.includes('وظيفة')), 'audit logged');
});

S('admin: candidates list, filters, detail actions', async ({ page, req }) => {
  await login(page, 'admin@test.com');
  await page.goto('/admin/candidates'); eq(await page.locator('.cand-card').count(), 2, 'candidates');
  await page.goto('/admin/candidates?skill=SAP'); eq(await page.locator('.cand-card').count(), 1, 'skill filter');
  await page.goto('/admin/candidates?tag=' + encodeURIComponent('مميز')); eq(await page.locator('.cand-card').count(), 1, 'tag filter');
  await page.goto('/admin/candidates?has_cv=1'); eq(await page.locator('.cand-card').count(), 0, 'has_cv (none on profile)');
  const d = `/admin/candidates/${IDS.candidate}`;
  await page.goto(d); includes(await page.textContent('main'), 'مطوّر Backend', 'headline'); includes(await page.textContent('main'), 'واتساب', 'wa button');
  let r = await post(req, d, { _action: 'set_status', app_id: IDS.app1, status: 'hired' }); eq(r.status, 303, 'status'); eq((await mockDb()).applications.find((a) => a.id === IDS.app1).status, 'hired', 'hired');
  r = await post(req, d, { _action: 'set_rating', app_id: IDS.app1, rating: '5' }); eq((await mockDb()).applications.find((a) => a.id === IDS.app1).rating, 5, 'rating');
  r = await post(req, d, { _action: 'add_note', app_id: IDS.app1, body: 'ملاحظة جديدة' }); eq((await mockDb()).application_notes.length, 2, 'note added');
  r = await post(req, d, { _action: 'schedule_interview', app_id: IDS.app1, scheduled_at: '2030-01-01T10:00', mode: 'onsite', location: 'المقر' }); eq(r.status, 303, 'interview');
  eq((await mockDb()).interviews.length, 2, 'interview inserted');
  r = await post(req, d, { _action: 'set_tags', tags: 'senior, مميز', admin_notes: 'ممتاز' }); eq((await mockDb()).profiles.find((p) => p.id === IDS.candidate).tags.length, 2, 'tags');
  r = await post(req, d, { _action: 'edit_profile', full_name: 'أحمد المرشح', phone: '0100', headline: 'Senior Backend', city: 'القاهرة', years_experience: '6', skills: 'Node.js', source: 'linkedin' });
  eq((await mockDb()).profiles.find((p) => p.id === IDS.candidate).years_experience, 6, 'profile edited');
  const cv = await get(req, `/admin/cv/${IDS.app1}`); eq(cv.status, 302, 'cv signed redirect');
  const csv = await req.get('/admin/candidates.csv'); includes(csv.headers()['content-type'], 'csv', 'csv export');
});

S('admin: client requests, multi-select shortlist, send to client', async ({ page, req }) => {
  await login(page, 'admin@test.com');
  await page.goto('/admin/requests'); eq(await page.locator('.req-card').count(), 1, 'requests');
  const d = `/admin/requests/${IDS.req1}`;
  await page.goto(d); expect((await page.locator('.picker-row').count()) >= 1, 'picker lists candidates not yet on list');
  let r = await req.post(d, { form: { _action: 'add_many', candidate_ids: IDS.candidate2 }, maxRedirects: 0 }); eq(r.status(), 303, 'add_many');
  const sl = (await mockDb()).client_shortlist.filter((x) => x.request_id === IDS.req1); eq(sl.length, 3, 'item added'); includes(sl.at(-1).headline, 'سارة', 'headline prefilled');
  r = await post(req, d, { _action: 'add_many' }); includes(r.text, 'اختر مرشح واحد', 'empty selection error');
  r = await post(req, d, { _action: 'send_all' }); eq(r.status, 303, 'send all');
  expect((await mockDb()).client_shortlist.filter((x) => x.request_id === IDS.req1).every((x) => x.admin_status === 'sent'), 'all sent');
  eq((await mockDb()).client_requests.find((x) => x.id === IDS.req1).status, 'candidates_sent', 'request status');
  r = await post(req, '/admin/requests', { id: IDS.req1, status: 'closed' }); eq((await mockDb()).client_requests.find((x) => x.id === IDS.req1).status, 'closed', 'status via list');
});

S('admin: inbox, reply, new conversation, contact messages', async ({ page, req }) => {
  await login(page, 'admin@test.com');
  await page.goto('/admin/inbox'); eq(await page.locator('.conv').count(), 1, 'conversations');
  let r = await post(req, `/admin/inbox/${IDS.conv1}`, { body: 'رد من الإدارة' }); eq(r.status, 303, 'reply'); eq((await mockDb()).messages.length, 2, 'message stored');
  r = await get(req, `/admin/inbox/new?candidate=${IDS.candidate2}`); eq(r.status, 303, 'new conversation created+redirect'); includes(r.location, '/admin/inbox/', 'to conversation');
  await page.goto('/admin/contact'); includes(await page.textContent('main'), 'عايز أعرف الأسعار', 'contact message');
  const id = (await mockDb()).contact_messages[0].id;
  r = await post(req, '/admin/contact', { id, _action: 'toggle' }); eq((await mockDb()).contact_messages[0].status, 'handled', 'handled');
  r = await post(req, '/admin/contact', { id, _action: 'note', note: 'اتصلنا' }); eq((await mockDb()).contact_messages[0].note, 'اتصلنا', 'note');
});

S('admin: content lists (add / toggle / reorder / delete) + settings', async ({ page, req }) => {
  await login(page, 'admin@test.com');
  let r = await post(req, '/admin/content/testimonials', { _action: 'save', name: 'عميل ثالث', quote: 'رائع', position: '999', published: 'on' }); eq(r.status, 303, 'testimonial added');
  let t = (await mockDb()).testimonials; eq(t.length, 3, 'three');
  const id = t.find((x) => x.name === 'عميل ثالث').id;
  r = await post(req, '/admin/content/testimonials', { id, _action: 'toggle' }); eq((await mockDb()).testimonials.find((x) => x.id === id).published, false, 'toggled off');
  r = await post(req, '/admin/content/testimonials', { id, _action: 'move_up' }); t = (await mockDb()).testimonials.sort((a, b) => a.position - b.position); eq(t[1].id, id, 'moved up one');
  r = await post(req, '/admin/content/testimonials', { id, _action: 'delete' }); eq((await mockDb()).testimonials.length, 2, 'deleted');
  r = await post(req, '/admin/content/faqs', { _action: 'save', question: 'س؟', answer: '<p>ج</p><script>x()</script>', position: '9', published: 'on' }); eq(r.status, 303, 'faq added');
  expect(!(await mockDb()).faqs.find((f) => f.question === 'س؟').answer.includes('<script'), 'faq answer sanitised');
  r = await post(req, '/admin/content/faqs', { _action: 'save', question: '', answer: '' }); includes(r.text, 'مطلوبين', 'faq validation');
  r = await post(req, '/admin/content/pricing', { _action: 'save', name: 'احترافي', price: '220', features: 'أ\nب\nج', featured: 'on', published: 'on', position: '2' }); eq((await mockDb()).pricing_plans.find((p) => p.name === 'احترافي').features.length, 3, 'features parsed');
  r = await post(req, '/admin/content/settings', { _tab: 'contact', contact_email: 'team@test.com', contact_phone: '+2010', whatsapp_number: '2010', theme_color: '#123456', stat_value_0: '+200', stat_label_0: 'شركة' });
  eq(r.status, 303, 'settings saved'); const st = (await mockDb()).site_settings; eq(st.find((s) => s.key === 'contact_email').value, 'team@test.com', 'setting upserted'); eq(st.find((s) => s.key === 'home_stats').value[0].value, '+200', 'stats upserted');
  r = await post(req, '/admin/content/settings', { _action: 'tg_discover' }); eq(r.status, 303, 'tg discover redirects'); includes(r.location, 'tg=notoken', 'tg discover reports missing token');
  r = await post(req, '/admin/content/settings', { _action: 'test_notify' }); eq(r.status, 303, 'test notify redirects'); includes(r.location, 'test=1', 'test notify ok');
  r = await get(req, '/admin/content/settings?tab=seo'); includes(r.text, 'اكتشاف محادثة تيليجرام', 'tg discover button'); includes(r.text, 'Conversions API', 'capi card');
  r = await post(req, '/admin/content/blog-layout', { layout: 'magazine', columns: '2', card: 'overlay', ratio: '4/3', per_page: '6', featured: 'on', show_excerpt: 'on', title: 'مدوّنتنا' });
  eq(r.status, 303, 'blog layout saved'); eq(st.length >= 3, true, 'x'); eq((await mockDb()).site_settings.find((s) => s.key === 'blog_layout').value.layout, 'magazine', 'layout stored');
  const pub = await get(req, '/blog'); includes(pub.text, 'layout-magazine', 'public blog uses layout'); includes(pub.text, 'مدوّنتنا', 'public blog title');
});

S('admin: site sections import + edit + public render', async ({ page, req }) => {
  await login(page, 'admin@test.com');
  let r = await post(req, '/admin/content/site', { _action: 'seed', page: 'recruitment' }); eq(r.status, 303, 'imported');
  const secs = (await mockDb()).site_sections.filter((s) => s.page === 'recruitment'); eq(secs.length, 6, 'six sections');
  const hero = secs.find((s) => s.kind === 'hero');
  r = await post(req, `/admin/content/site/recruitment`, { _action: 'save', id: hero.id, kind: 'hero', eyebrow: 'خدمة التوظيف', title: 'عنوان معدّل', body_html: '<p>نص</p>', cta_label: 'اطلب', cta_href: '/contact' });
  eq(r.status, 303, 'hero saved');
  const pub = await get(req, '/recruitment'); includes(pub.text, 'عنوان معدّل', 'public renders edited hero'); includes(pub.text, 'رحلة التوظيف معانا', 'steps section rendered');
  r = await post(req, '/admin/content/site/recruitment', { _action: 'toggle', id: secs.find((s) => s.kind === 'cta').id }); expect(!(await get(req, '/recruitment')).text.includes('عندك دور شاغر محتاج تتملى'), 'hidden section not rendered');
  r = await post(req, '/admin/content/site', { _action: 'seed', page: 'recruitment' }); includes(r.text, 'فيها أقسام بالفعل', 'no double import');
  r = await post(req, '/admin/content/site', { _action: 'seed', page: 'home' }); eq(r.status, 303, 'home imported');
  const home = await get(req, '/'); includes(home.text, 'أربعة أعمدة', 'home cards section'); includes(home.text, 'فرص مفتوحة دلوقتي', 'home jobs section'); includes(home.text, 'Backend Developer', 'home lists jobs');
});

S('admin: JD templates import/edit + pages + blog editor + media', async ({ page, req }) => {
  await login(page, 'admin@test.com');
  let r = await post(req, '/admin/content/jd', { _action: 'seed' }); eq(r.status, 303, 'jd imported'); eq((await mockDb()).jd_templates.length, 6, 'six templates');
  r = await post(req, '/admin/content/jd', { _action: 'save', title: 'مدير مشروعات', sector: 'إدارة', summary: 'x', body_html: '<h2>المهام</h2><ul><li>أ</li></ul>' }); eq((await mockDb()).jd_templates.length, 7, 'template added');
  const docx = await req.get('/jd-templates/jd-mdyr-mshrwaat.docx'); expect(docx.status() === 200 || docx.status() === 404, 'slug generated');
  const t = (await mockDb()).jd_templates.find((x) => x.title === 'مدير مشروعات'); eq((await req.get(`/jd-templates/${t.slug}.docx`)).status(), 200, 'new template downloads');
  // pages
  r = await post(req, '/admin/pages', { title: 'عن الفريق', slug: 'team' }); eq(r.status, 303, 'page created');
  const pg = (await mockDb()).pages.find((p) => p.slug === 'team'); eq((await get(req, '/team')).status, 404, 'draft page hidden');
  r = await post(req, `/admin/pages/${pg.id}`, { title: 'عن الفريق', slug: 'team', description: 'd', body_html: '<p>فريقنا</p>', status: 'published' }); eq(r.status, 303, 'page published');
  includes((await get(req, '/team')).text, 'فريقنا', 'public page');
  r = await post(req, '/admin/pages', { title: 'x', slug: 'careers' }); includes(r.text, 'محجوز', 'reserved slug blocked');
  // blog
  r = await post(req, '/admin/blog', { title: 'مقال جديد', slug: 'new-post' }); eq(r.status, 303, 'post created');
  const post1 = (await mockDb()).posts.find((p) => p.slug === 'new-post');
  r = await post(req, `/admin/blog/${post1.id}`, { title: 'مقال جديد', slug: 'new-post', excerpt: 'مقتطف', category: 'موارد بشرية', body_html: '<p>محتوى</p>', tags: 'a, b', status: 'published' }); eq(r.status, 303, 'post published');
  const np = (await mockDb()).posts.find((p) => p.slug === 'new-post'); expect(!!np.published_at, 'published_at set once'); eq(np.category, 'موارد بشرية', 'category');
  includes((await get(req, '/blog/new-post')).text, 'محتوى', 'public post');
  // media upload endpoint
  const up = await postMultipart(req, '/admin/media/upload', { file: { name: 'pic.png', mimeType: 'image/png', buffer: Buffer.from([137, 80, 78, 71]) } });
  eq(up.status, 200, 'upload ok'); includes(up.text, '"url"', 'returns url'); eq((await mockDb()).media.length, 2, 'media row');
  const bad = await postMultipart(req, '/admin/media/upload', { file: { name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('x') } }); eq(bad.status, 400, 'rejects non-image');
});

S('admin: staff roles + activity log', async ({ page, req }) => {
  await login(page, 'admin@test.com');
  await page.goto('/admin/staff'); includes(await page.textContent('main'), 'محرّر محتوى', 'role cards');
  let r = await post(req, '/admin/staff', { uid: IDS.candidate2, role: 'support' }); eq(r.status, 303, 'role changed'); eq((await mockDb()).profiles.find((p) => p.id === IDS.candidate2).role, 'support', 'now support');
  r = await post(req, '/admin/staff', { uid: IDS.admin, role: 'viewer' }); includes(r.text, 'لا يمكنك إزالة صلاحية المدير عن نفسك', 'self-demotion blocked');
  const act = await get(req, `/admin/activity?actor=${IDS.admin}`); eq(act.status, 200, 'activity filter'); includes(act.text, 'تغيير دور', 'logged role change');
});

S('roles: recruiter / editor / support / viewer boundaries', async ({ browser: _b }) => {
  const check = async (email, allowed, blocked) => {
    const ctx = await browser.newContext({ baseURL: BASE }); const page = await ctx.newPage(); await login(page, email);
    for (const p of allowed) eq((await get(ctx.request, p)).status, 200, `${email} can open ${p}`);
    for (const p of blocked) { const r = await get(ctx.request, p); eq(r.status, 302, `${email} blocked from ${p}`); includes(r.location, 'denied=1', 'denied flag'); }
    return ctx;
  };
  (await check('recruiter@test.com', ['/admin', '/admin/jobs', '/admin/candidates', '/admin/requests', '/admin/inbox', '/admin/contact'], ['/admin/blog', '/admin/content', '/admin/staff', '/admin/analytics'])).close();
  (await check('editor@test.com', ['/admin', '/admin/blog', '/admin/pages', '/admin/content', '/admin/media'], ['/admin/jobs', '/admin/candidates', '/admin/staff'])).close();
  (await check('support@test.com', ['/admin', '/admin/requests', '/admin/inbox', '/admin/contact'], ['/admin/jobs', '/admin/blog', '/admin/candidates'])).close();
  const v = await check('viewer@test.com', ['/admin', '/admin/jobs', '/admin/candidates', '/admin/analytics'], ['/admin/inbox', '/admin/blog']);
  const before = (await mockDb()).jobs.find((j) => j.id === IDS.jobBackend).status;
  const r = await post(v.request, '/admin/jobs', { id: IDS.jobBackend, status: 'closed' }); eq(r.status, 303, 'viewer write redirected'); includes(r.location, 'denied=1', 'viewer denied');
  eq((await mockDb()).jobs.find((j) => j.id === IDS.jobBackend).status, before, 'viewer could not change data');
  await v.close();
});

if (process.env.E2E_SHOT) S('shot: mobile screenshots of admin lists', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, 'admin@test.com');
  for (const [path, name] of [['/admin', 'overview'], ['/admin/jobs', 'jobs'], ['/admin/blog', 'blog'], ['/admin/staff', 'staff'], ['/admin/activity', 'activity'], ['/admin/candidates', 'candidates']]) {
    await page.goto(path); await page.screenshot({ path: `${process.env.E2E_SHOT}/${name}.png`, fullPage: true });
  }
});

S('auth: wrong password, logout, protected redirects', async ({ page, req }) => {
  await page.goto('/login'); await page.fill('input[name=email]', 'cand@test.com'); await page.fill('input[name=password]', 'wrong');
  await page.click('button[type=submit]'); await page.waitForLoadState('load'); includes(await page.textContent('main'), 'غير صحيحة', 'wrong password message');
  let r = await get(req, '/dashboard'); eq(r.status, 302, 'guest redirected'); includes(r.location, '/login?next=%2Fdashboard', 'next param');
  await login(page, 'cand@test.com'); eq((await get(req, '/dashboard')).status, 200, 'logged in');
  r = await get(req, '/logout'); eq(r.status, 303, 'logout'); eq((await get(req, '/dashboard')).status, 302, 'session cleared');
});

// ---------- runner ----------
async function main() {
  const mock = spawn('node', ['tests/mock-supabase.mjs', String(MOCK)], { stdio: ['ignore', 'inherit', 'inherit'] });
  // The Cloudflare dev runtime routes fetch() through HTTPS_PROXY without honouring NO_PROXY, which
  // would block the local mock — the app process runs without proxy vars (it only talks to localhost here).
  const env = { ...process.env, PUBLIC_SUPABASE_URL: MOCK_URL, PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key', RESEND_API_KEY: '', ASTRO_TELEMETRY_DISABLED: '1' };
  for (const k of Object.keys(env)) if (/^(https?_proxy|GLOBAL_AGENT_HTTPS_PROXY)$/i.test(k)) delete env[k];
  const app = spawn('npx', ['astro', 'dev', '--port', String(APP)], { stdio: ['ignore', 'pipe', 'pipe'], env });
  app.stderr.on('data', (d) => { const s = d.toString(); if (/error/i.test(s)) process.stderr.write(s); });
  try {
    await waitFor(MOCK_URL + '/__db'); await waitFor(BASE + '/');
    browser = await chromium.launch({ executablePath: EXE });
    console.log(`Running ${scenarios.length} scenarios…`);
    const only = process.env.E2E_ONLY ? scenarios.filter(([n]) => n.includes(process.env.E2E_ONLY)) : scenarios;
    for (const [name, fn] of only) { await reset(); await scenario(name, fn); }
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} passed`);
    process.exitCode = failed.length ? 1 : 0;
  } catch (e) { console.error(e); process.exitCode = 1; }
  finally { await browser?.close(); app.kill('SIGTERM'); mock.kill('SIGTERM'); setTimeout(() => process.exit(process.exitCode ?? 0), 1500).unref(); }
}
main();
