// Staff roles and what each one can open in /admin. Mirrors the RLS policies in
// docs/migration-13-roles.sql — the DB is the real gate, this drives nav + redirects.

export const STAFF_ROLES = ['admin', 'recruiter', 'editor', 'support', 'viewer'] as const;
export type StaffRole = typeof STAFF_ROLES[number];

export const ROLE_AR: Record<string, string> = {
  admin: 'مدير',
  recruiter: 'مسؤول توظيف',
  editor: 'محرّر محتوى',
  support: 'خدمة عملاء',
  viewer: 'مشاهد (قراءة فقط)',
  candidate: 'مرشح',
  client: 'عميل',
};

export const ROLE_DESC: Record<StaffRole, string> = {
  admin: 'كل الصلاحيات، بما فيها الفريق والإعدادات.',
  recruiter: 'الوظائف، المرشحون، المقابلات، طلبات الشركات، الرسائل.',
  editor: 'المدوّنة، الصفحات، المحتوى، الوسائط.',
  support: 'طلبات الشركات والرسائل فقط.',
  viewer: 'يشوف الوظائف والمرشحين والطلبات والتحليلات من غير ما يعدّل.',
};

/** Sidebar section → roles allowed to open it. */
const SECTIONS: Record<string, readonly string[]> = {
  home:       STAFF_ROLES,
  jobs:       ['admin', 'recruiter', 'viewer'],
  candidates: ['admin', 'recruiter', 'viewer'],
  interviews: ['admin', 'recruiter', 'viewer'],
  requests:   ['admin', 'recruiter', 'support', 'viewer'],
  inbox:      ['admin', 'recruiter', 'support'],
  contact:    ['admin', 'recruiter', 'support'],
  blog:       ['admin', 'editor'],
  pages:      ['admin', 'editor'],
  content:    ['admin', 'editor'],
  media:      ['admin', 'editor'],
  analytics:  ['admin', 'viewer'],
  staff:      ['admin'],
  activity:   ['admin'],
};

export function isStaff(role?: string | null): boolean {
  return !!role && (STAFF_ROLES as readonly string[]).includes(role);
}

export function can(role: string | null | undefined, section: string): boolean {
  if (!role) return false;
  return (SECTIONS[section] ?? ['admin']).includes(role);
}

/** Maps an /admin/... path to its section key. */
export function sectionFor(path: string): string {
  const seg = path.replace(/^\/admin\/?/, '').split('/')[0];
  if (!seg) return 'home';
  if (seg === 'applications' || seg === 'cv') return 'candidates';
  return seg;
}

/** Roles that may write (viewer is read-only everywhere). */
export function canWrite(role?: string | null): boolean {
  return isStaff(role) && role !== 'viewer';
}
