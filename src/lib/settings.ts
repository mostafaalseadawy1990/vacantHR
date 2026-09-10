import { anonClient } from './supabase';

export type Settings = {
  contact_email: string;
  contact_phone: string;
  whatsapp_number: string;
  address: string;
  working_hours: string;
  linkedin_url: string;
  company_blurb: string;
  home_hero_eyebrow: string;
  home_hero_title: string;
  home_hero_lead: string;
  home_stats: Array<{ value: string; label: string }>;
  analytics_snippet: string;
  google_site_verification: string;
  logo_path: string;
  favicon_path: string;
  theme_color: string;
};

export const DEFAULT_SETTINGS: Settings = {
  contact_email: 'info@vacanthr.com',
  contact_phone: '+201000000000',
  whatsapp_number: '201000000000',
  address: 'القاهرة، مصر',
  working_hours: 'الأحد – الخميس، 9 صباحًا – 5 مساءً',
  linkedin_url: 'https://www.linkedin.com/company/vacanthr',
  company_blurb: 'حلول متكاملة للتوظيف وإدارة الموارد البشرية للشركات الناشئة والمتوسطة.',
  home_hero_eyebrow: 'شريكك في إدارة رأس المال البشري',
  home_hero_title: 'نبني أنظمة التوظيف والموارد البشرية التي تكبر مع شركتك',
  home_hero_lead:
    'من إيجاد الكفاءة المناسبة، إلى إدارة بيانات موظفيك يوميًا، وصولًا لهيكلة سياسات عملك — Vacant HR تجمع الخدمة البشرية والتقنية في مكان واحد.',
  home_stats: [
    { value: '+120', label: 'شركة تثق بينا' },
    { value: '+3,400', label: 'توظيف ناجح' },
    { value: '18', label: 'قطاع مختلف' },
    { value: '92%', label: 'نسبة رضا العملاء' },
  ],
  analytics_snippet: '',
  google_site_verification: '',
  logo_path: '',
  favicon_path: '',
  theme_color: '#0E7C66',
};

export type Post = {
  id: string; slug: string; title: string; excerpt: string; cover_path: string | null;
  body_md: string; tags: string[]; status: 'draft' | 'published';
  published_at: string | null; created_at: string; updated_at: string;
};

export type GuideSection = {
  id: string; slug: string; title: string; body_md: string;
  video_url: string | null; position: number; published: boolean;
};

export type Testimonial = { id: string; name: string; title: string | null; quote: string; position: number; published: boolean };
export type Faq = { id: string; question: string; answer: string; position: number; published: boolean };
export type PricingPlan = {
  id: string; name: string; price: string; unit: string | null; note: string | null;
  features: string[]; featured: boolean; cta_label: string | null; position: number; published: boolean;
};

type CacheEntry<T> = { at: number; data: T };
const TTL = 60_000;
const cache = new Map<string, CacheEntry<unknown>>();

async function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  try {
    const data = await loader();
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch {
    if (hit) return hit.data; // serve stale on failure
    throw new Error(`settings loader failed: ${key}`);
  }
}

export function getSettings(): Promise<Settings> {
  return cached('settings', async () => {
    const { data, error } = await anonClient().from('site_settings').select('key, value');
    if (error) throw error;
    const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    for (const row of data ?? []) merged[row.key] = row.value;
    return merged as Settings;
  }).catch(() => DEFAULT_SETTINGS);
}

export function getTestimonials(): Promise<Testimonial[]> {
  return cached('testimonials', async () => {
    const { data, error } = await anonClient()
      .from('testimonials').select('*').eq('published', true).order('position');
    if (error) throw error;
    return (data ?? []) as Testimonial[];
  }).catch(() => []);
}

export function getFaqs(): Promise<Faq[]> {
  return cached('faqs', async () => {
    const { data, error } = await anonClient()
      .from('faqs').select('*').eq('published', true).order('position');
    if (error) throw error;
    return (data ?? []) as Faq[];
  }).catch(() => []);
}

export function getPricingPlans(): Promise<PricingPlan[]> {
  return cached('pricing', async () => {
    const { data, error } = await anonClient()
      .from('pricing_plans').select('*').eq('published', true).order('position');
    if (error) throw error;
    return (data ?? []) as PricingPlan[];
  }).catch(() => []);
}

export function getPosts(): Promise<Post[]> {
  return cached('posts', async () => {
    const { data, error } = await anonClient()
      .from('posts')
      .select('id, slug, title, excerpt, cover_path, tags, status, published_at, created_at, updated_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(60);
    if (error) throw error;
    return (data ?? []) as Post[];
  }).catch(() => []);
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const { data } = await anonClient()
    .from('posts').select('*').eq('slug', slug).eq('status', 'published').maybeSingle();
  return (data as Post) ?? null;
}

export function getGuideSections(): Promise<GuideSection[]> {
  return cached('guide', async () => {
    const { data, error } = await anonClient()
      .from('guide_sections').select('*').eq('published', true).order('position');
    if (error) throw error;
    return (data ?? []) as GuideSection[];
  }).catch(() => []);
}

/** YouTube watch/share/embed URL -> privacy-enhanced embed URL, or null. */
export function ytEmbed(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : null;
}

/** Public URL for a file in the `media` bucket. */
export function mediaUrl(path: string): string {
  const base = import.meta.env.PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/media/${path}`;
}
