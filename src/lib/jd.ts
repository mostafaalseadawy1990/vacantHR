// Job-description templates: DB-backed (jd_templates) with the bundled markdown files as defaults/seed.
import { anonClient } from './supabase';
import { renderMarkdown } from './jobs';

export type JdTemplate = {
  id: string; slug: string; title: string; sector: string | null; summary: string; body_html: string;
  downloads: number; position: number; published: boolean; updated_at?: string;
};

const files = import.meta.glob('../data/jd/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const META: Record<string, { title: string; sector: string; summary: string }> = {
  'jd-software-developer': { title: 'مطوّر برمجيات', sector: 'تقنية المعلومات', summary: 'المهام، المهارات التقنية المطلوبة، ومتطلبات الخبرة لدور مطور Backend أو Frontend، مع مؤشرات أداء مقترحة.' },
  'jd-account-manager': { title: 'مدير حسابات', sector: 'المبيعات', summary: 'وصف كامل لدور مدير الحسابات مع مؤشرات الأداء (KPIs) المقترحة ومسؤوليات التجديد والبيع الإضافي.' },
  'jd-digital-marketing-specialist': { title: 'أخصائي تسويق رقمي', sector: 'التسويق', summary: 'يشمل المهام اليومية، الأدوات المطلوب إتقانها، المؤهلات الأساسية، ومؤشرات مثل CPL و CAC.' },
  'jd-senior-accountant': { title: 'محاسب أول', sector: 'المالية', summary: 'نموذج متوافق مع الممارسات المحاسبية المصرية، يشمل المهارات، الإقرارات الضريبية، والشهادات المطلوبة.' },
  'jd-hr-generalist': { title: 'أخصائي موارد بشرية', sector: 'الموارد البشرية', summary: 'وصف وظيفي لدور HR Generalist يغطي التوظيف، شؤون الموظفين، والامتثال لقانون العمل.' },
  'jd-customer-service-representative': { title: 'ممثل خدمة عملاء', sector: 'خدمة العملاء', summary: 'نموذج مرن يصلح للعمل الحضوري أو عن بعد، مع مهارات التواصل المطلوبة ومؤشرات CSAT و FCR.' },
};

/** Markdown → HTML for the bundled files (drops the top H1 and the "template by" quote line). */
function mdToHtml(md: string): string {
  const body = md.replace(/^# .*\n/, '').replace(/^> .*\n/m, '').replace(/^---\n\*[^\n]*\*\s*$/m, '');
  return renderMarkdown(body);
}

export const DEFAULT_JD: JdTemplate[] = Object.keys(META).map((slug, i) => ({
  id: slug, slug, title: META[slug].title, sector: META[slug].sector, summary: META[slug].summary,
  body_html: mdToHtml(Object.entries(files).find(([k]) => k.endsWith(`/${slug}.md`))?.[1] ?? ''),
  downloads: 0, position: i + 1, published: true,
}));

export async function getJdTemplates(): Promise<{ items: JdTemplate[]; fromDb: boolean }> {
  try {
    const { data, error } = await anonClient().from('jd_templates').select('*').eq('published', true).order('position');
    if (error || !data || data.length === 0) return { items: DEFAULT_JD, fromDb: false };
    return { items: data as JdTemplate[], fromDb: true };
  } catch { return { items: DEFAULT_JD, fromDb: false }; }
}

export async function getJdTemplate(slug: string): Promise<JdTemplate | null> {
  const { items } = await getJdTemplates();
  return items.find((t) => t.slug === slug) ?? null;
}
