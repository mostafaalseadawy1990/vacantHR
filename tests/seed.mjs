// Seed data for the mock Supabase. Deterministic ids so scenarios can reference them.
const now = new Date();
const iso = (d) => d.toISOString();
const daysAgo = (n) => iso(new Date(now.getTime() - n * 864e5));
const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const IDS = {
  admin: U(1), recruiter: U(2), editor: U(3), viewer: U(4), support: U(5), candidate: U(10), candidate2: U(11), client: U(20),
  jobBackend: U(100), jobAccountant: U(101), jobMarketing: U(102), jobDraft: U(103), jobClosed: U(104), jobExternal: U(105),
  app1: U(200), app2: U(201), post1: U(300), post2: U(301), page1: U(400), req1: U(500), sl1: U(600), sl2: U(601),
  conv1: U(700), iv1: U(800), media1: U(900),
};

export function seed() {
  const users = [
    { id: IDS.admin, email: 'admin@test.com', password: 'Passw0rd!', created_at: daysAgo(90) },
    { id: IDS.recruiter, email: 'recruiter@test.com', password: 'Passw0rd!', created_at: daysAgo(60) },
    { id: IDS.editor, email: 'editor@test.com', password: 'Passw0rd!', created_at: daysAgo(60) },
    { id: IDS.viewer, email: 'viewer@test.com', password: 'Passw0rd!', created_at: daysAgo(60) },
    { id: IDS.support, email: 'support@test.com', password: 'Passw0rd!', created_at: daysAgo(60) },
    { id: IDS.candidate, email: 'cand@test.com', password: 'Passw0rd!', created_at: daysAgo(20) },
    { id: IDS.candidate2, email: 'cand2@test.com', password: 'Passw0rd!', created_at: daysAgo(5) },
    { id: IDS.client, email: 'client@test.com', password: 'Passw0rd!', created_at: daysAgo(30) },
  ];
  const profile = (id, role, full_name, extra = {}) => ({ id, role, full_name, email: users.find((u) => u.id === id).email, phone: null, company_name: null, skills: [], tags: [], headline: null, city: null, years_experience: null, education: null, current_company: null, expected_salary: null, availability: null, linkedin_url: null, portfolio_url: null, birth_year: null, bio: null, cv_path: null, admin_notes: null, source: null, created_at: users.find((u) => u.id === id).created_at, updated_at: daysAgo(1), ...extra });
  const job = (id, slug, title, extra = {}) => ({ id, slug, title, department: 'التقنية', location: 'القاهرة، مصر', employment_type: 'full_time', workplace: 'hybrid', experience_level: '3–5 سنوات', salary_min: 15000, salary_max: 22000, salary_currency: 'EGP', salary_visible: true, description_md: '## عن الدور\nبنبحث عن مطوّر.\n- تصميم APIs\n- اختبارات', requirements_md: '- 3+ سنوات\n- SQL', skills: ['Node.js', 'SQL', 'Git'], status: 'open', apply_url: null, created_by: IDS.admin, published_at: daysAgo(3), created_at: daysAgo(4), updated_at: daysAgo(3), ...extra });

  return {
    __users: users,
    profiles: [
      profile(IDS.admin, 'admin', 'Admin User'),
      profile(IDS.recruiter, 'recruiter', 'Recruiter User'),
      profile(IDS.editor, 'editor', 'Editor User'),
      profile(IDS.viewer, 'viewer', 'Viewer User'),
      profile(IDS.support, 'support', 'Support User'),
      profile(IDS.candidate, 'candidate', 'أحمد المرشح', { phone: '01012345678', skills: ['Node.js', 'SQL', 'Excel'], headline: 'مطوّر Backend', city: 'القاهرة', years_experience: 4, availability: 'immediate', tags: ['مميز'] }),
      profile(IDS.candidate2, 'candidate', 'سارة المرشحة', { skills: ['Excel', 'SAP'] }),
      profile(IDS.client, 'client', 'محمد العميل', { company_name: 'شركة نور', phone: '01098765432' }),
    ],
    jobs: [
      job(IDS.jobBackend, 'backend-developer-cairo', 'Backend Developer'),
      job(IDS.jobAccountant, 'senior-accountant', 'محاسب أول', { department: 'المالية', skills: ['Excel', 'SAP', 'ضرائب'], workplace: 'onsite', published_at: daysAgo(10) }),
      job(IDS.jobMarketing, 'digital-marketing-specialist', 'أخصائي تسويق رقمي', { department: 'التسويق', skills: ['Google Ads', 'SEO'], salary_visible: false, published_at: daysAgo(1) }),
      job(IDS.jobDraft, 'draft-role', 'وظيفة مسودة', { status: 'draft', published_at: null }),
      job(IDS.jobClosed, 'closed-role', 'وظيفة مغلقة', { status: 'closed' }),
      job(IDS.jobExternal, 'external-apply-role', 'وظيفة بتقديم خارجي', { apply_url: 'https://forms.gle/example', department: 'المبيعات' }),
    ],
    applications: [
      { id: IDS.app1, job_id: IDS.jobBackend, candidate_id: IDS.candidate, status: 'shortlisted', rating: 4, cover_note: 'مهتم جدًا', cv_path: `${IDS.candidate}/cv.pdf`, created_at: daysAgo(2) },
      { id: IDS.app2, job_id: IDS.jobAccountant, candidate_id: IDS.candidate2, status: 'submitted', rating: null, cover_note: null, cv_path: `${IDS.candidate2}/cv.pdf`, created_at: daysAgo(1) },
    ],
    application_notes: [{ id: U(250), application_id: IDS.app1, author_id: IDS.admin, body: 'مقابلة أولى ممتازة', created_at: daysAgo(1) }],
    interviews: [{ id: IDS.iv1, application_id: IDS.app1, scheduled_at: iso(new Date(now.getTime() + 2 * 864e5)), mode: 'online', location: 'https://meet.google.com/abc', status: 'confirmed', created_by: IDS.admin, created_at: daysAgo(1) }],
    saved_jobs: [{ job_id: IDS.jobMarketing, candidate_id: IDS.candidate, created_at: daysAgo(1) }],
    job_views: [{ job_id: IDS.jobBackend, day: daysAgo(1).slice(0, 10), count: 40 }, { job_id: IDS.jobAccountant, day: daysAgo(2).slice(0, 10), count: 12 }],
    client_requests: [{ id: IDS.req1, client_id: IDS.client, role_title: 'مسؤول مبيعات', headcount: 2, details_md: 'خبرة B2B', status: 'candidates_sent', created_at: daysAgo(6) }],
    client_shortlist: [
      { id: IDS.sl1, request_id: IDS.req1, candidate_id: IDS.candidate, headline: 'مرشح أول — 4 سنوات', summary: 'ممتاز', admin_status: 'sent', client_decision: 'pending', client_note: null, position: 1, created_at: daysAgo(3) },
      { id: IDS.sl2, request_id: IDS.req1, candidate_id: null, headline: 'مرشح مسودة', summary: '', admin_status: 'draft', client_decision: 'pending', client_note: null, position: 2, created_at: daysAgo(2) },
    ],
    conversations: [{ id: IDS.conv1, participant_id: IDS.candidate, subject: 'بخصوص طلبك', application_id: IDS.app1, request_id: null, last_message_at: daysAgo(1), created_at: daysAgo(2) }],
    messages: [{ id: U(750), conversation_id: IDS.conv1, sender_id: IDS.admin, body: 'أهلًا أحمد', created_at: daysAgo(2) }],
    posts: [
      { id: IDS.post1, slug: 'how-to-hire', title: 'كيف توظّف صح', excerpt: 'دليل عملي', cover_path: null, body_md: '', body_html: '<h2>مقدمة</h2><p>نص المقال</p>', tags: ['توظيف'], category: 'توظيف', author_name: null, status: 'published', author_id: IDS.admin, published_at: daysAgo(5), created_at: daysAgo(6), updated_at: daysAgo(5) },
      { id: IDS.post2, slug: 'draft-post', title: 'مسودة', excerpt: '', cover_path: null, body_md: '', body_html: '', tags: [], category: null, author_name: null, status: 'draft', author_id: IDS.admin, published_at: null, created_at: daysAgo(1), updated_at: daysAgo(1) },
    ],
    pages: [{ id: IDS.page1, slug: 'services', title: 'خدماتنا', description: 'صفحة الخدمات', body_html: '<p>محتوى صفحة الخدمات</p>', status: 'published', created_by: IDS.admin, created_at: daysAgo(3), updated_at: daysAgo(3) }],
    site_settings: [
      { key: 'contact_email', value: 'info@test.com', updated_at: daysAgo(1) },
      { key: 'whatsapp_number', value: '201000000000', updated_at: daysAgo(1) },
      { key: 'home_stats', value: [{ value: '+120', label: 'شركة' }], updated_at: daysAgo(1) },
    ],
    testimonials: [{ id: U(1000), name: 'عميل سعيد', title: 'CEO', quote: 'خدمة ممتازة', position: 1, published: true }, { id: U(1001), name: 'عميل مخفي', title: null, quote: 'مخفي', position: 2, published: false }],
    faqs: [{ id: U(1100), question: 'هل الخدمة مجانية؟', answer: '<p>لا</p>', position: 1, published: true }],
    pricing_plans: [{ id: U(1200), name: 'أساسي', price: '150 ج.م', unit: '/ موظف', note: null, features: ['حضور', 'إجازات'], featured: false, cta_label: 'ابدأ', position: 1, published: true }],
    guide_sections: [{ id: U(1300), slug: 'intro', title: 'مقدمة', body_md: 'مرحبًا', body_html: '', video_url: null, position: 1, published: true }],
    media: [{ id: IDS.media1, path: '1700000000-logo.png', alt: 'الشعار', created_by: IDS.admin, created_at: daysAgo(10) }],
    events: Array.from({ length: 30 }, (_, i) => ({ id: i + 1, kind: 'pageview', path: ['/', '/careers', '/blog'][i % 3], ref: i % 4 ? 'google.com' : '', device: i % 2 ? 'mobile' : 'desktop', utm_source: null, utm_medium: null, utm_campaign: null, day: daysAgo(i % 7).slice(0, 10), created_at: daysAgo(i % 7) })),
    audit_log: [{ id: 1, actor_id: IDS.admin, actor_name: 'Admin User', actor_role: 'admin', action: 'إنشاء وظيفة', target: 'Backend Developer', created_at: daysAgo(4) }],
    contact_messages: [{ id: U(1400), name: 'زائر', email: 'visitor@test.com', message: 'عايز أعرف الأسعار', company: null, phone: null, service: 'برنامج HRM SaaS', source: '/contact', status: 'new', note: null, created_at: daysAgo(1) }],
    jd_templates: [],
    site_sections: [],
  };
}
