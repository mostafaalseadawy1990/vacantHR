import { anonClient } from './supabase';

export type Page = {
  id: string; slug: string; title: string; description: string; body_html: string;
  status: 'draft' | 'published'; created_at: string; updated_at: string;
};

/** Paths that belong to built-in routes — a CMS page can never shadow them. */
export const RESERVED_SLUGS = new Set([
  'admin', 'dashboard', 'login', 'logout', 'signup', 'careers', 'blog', 'about', 'contact', 'privacy',
  'recruitment', 'hrm-saas', 'hrm-guide', 'consulting', 'jd-templates', 'thanks', 'e', 'rss.xml', 'sitemap.xml',
  'robots.txt', 'favicon.svg', 'og-image.png', 'style.css', 'script.js', 'templates', '404',
]);

export async function getPublishedPage(slug: string): Promise<Page | null> {
  const { data } = await anonClient()
    .from('pages').select('*').eq('slug', slug).eq('status', 'published').maybeSingle();
  return (data as Page) ?? null;
}
