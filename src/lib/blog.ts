// Blog listing layout options (Flatsome-style controls) stored in site_settings.blog_layout.

export type BlogLayout = {
  layout: 'grid' | 'list' | 'magazine' | 'masonry';
  columns: 2 | 3 | 4;
  card: 'shadow' | 'border' | 'flat' | 'overlay';
  ratio: '16/9' | '4/3' | '3/2' | '1/1';
  featured: boolean;          // first post as a wide hero
  sidebar: boolean;           // categories + latest posts column
  per_page: number;
  show_excerpt: boolean; show_date: boolean; show_author: boolean; show_readtime: boolean; show_category: boolean;
  title: string; lead: string;
};

export const DEFAULT_BLOG_LAYOUT: BlogLayout = {
  layout: 'grid', columns: 3, card: 'shadow', ratio: '16/9', featured: true, sidebar: false, per_page: 9,
  show_excerpt: true, show_date: true, show_author: false, show_readtime: true, show_category: true,
  title: 'أفكار ودلائل في التوظيف والموارد البشرية',
  lead: '',
};

export const BLOG_OPTIONS = {
  layout: [['grid', 'شبكة (Grid)'], ['list', 'قائمة (List)'], ['magazine', 'مجلة (مقال كبير + صغار)'], ['masonry', 'Masonry (ارتفاعات مختلفة)']],
  columns: [['2', 'عمودين'], ['3', '٣ أعمدة'], ['4', '٤ أعمدة']],
  card: [['shadow', 'بطاقة بظل'], ['border', 'بطاقة بإطار'], ['flat', 'بدون إطار (Flat)'], ['overlay', 'العنوان فوق الصورة (Overlay)']],
  ratio: [['16/9', 'عريض 16:9'], ['4/3', '4:3'], ['3/2', '3:2'], ['1/1', 'مربع 1:1']],
} as const;

export function parseBlogLayout(raw: unknown): BlogLayout {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, allowed: readonly T[], d: T): T => (allowed.includes(v as T) ? (v as T) : d);
  const b = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  return {
    layout: pick(o.layout, ['grid', 'list', 'magazine', 'masonry'], 'grid'),
    columns: ([2, 3, 4].includes(Number(o.columns)) ? Number(o.columns) : 3) as 2 | 3 | 4,
    card: pick(o.card, ['shadow', 'border', 'flat', 'overlay'], 'shadow'),
    ratio: pick(o.ratio, ['16/9', '4/3', '3/2', '1/1'], '16/9'),
    featured: b(o.featured, true), sidebar: b(o.sidebar, false),
    per_page: Math.min(48, Math.max(3, Number(o.per_page) || 9)),
    show_excerpt: b(o.show_excerpt, true), show_date: b(o.show_date, true), show_author: b(o.show_author, false),
    show_readtime: b(o.show_readtime, true), show_category: b(o.show_category, true),
    title: typeof o.title === 'string' && o.title.trim() ? o.title : DEFAULT_BLOG_LAYOUT.title,
    lead: typeof o.lead === 'string' ? o.lead : '',
  };
}

/** Reads the layout form (admin) into a BlogLayout. */
export function blogLayoutFromForm(form: FormData): BlogLayout {
  const g = (k: string) => form.get(k);
  return parseBlogLayout({
    layout: g('layout'), columns: g('columns'), card: g('card'), ratio: g('ratio'),
    featured: g('featured') === 'on', sidebar: g('sidebar') === 'on', per_page: g('per_page'),
    show_excerpt: g('show_excerpt') === 'on', show_date: g('show_date') === 'on', show_author: g('show_author') === 'on',
    show_readtime: g('show_readtime') === 'on', show_category: g('show_category') === 'on',
    title: String(g('title') ?? '').trim(), lead: String(g('lead') ?? '').trim(),
  });
}

/** ~200 Arabic words per minute. */
export function readingTime(html: string): number {
  const words = (html ?? '').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
