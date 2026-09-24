import type { APIRoute } from 'astro';
import { anonClient } from '../lib/supabase';

export const prerender = false;

const SITE = 'https://vacanthr.com';
const STATIC: Array<[string, string]> = [
  ['/', 'weekly'],
  ['/recruitment', 'monthly'],
  ['/hrm-saas', 'monthly'],
  ['/consulting', 'monthly'],
  ['/jd-templates', 'monthly'],
  ['/hrm-guide', 'monthly'],
  ['/careers', 'daily'],
  ['/blog', 'weekly'],
  ['/about', 'yearly'],
  ['/contact', 'yearly'],
  ['/privacy', 'yearly'],
];

// An empty <lastmod></lastmod> makes the sitemap invalid for Google — omit it instead.
const lastmod = (d: string | null) => (d ? `<lastmod>${d.slice(0, 10)}</lastmod>` : '');

export const GET: APIRoute = async () => {
  // Never let a DB hiccup turn the sitemap into a 5xx — fall back to the static URLs.
  let jobs: Array<{ slug: string; updated_at: string | null }> | null = null;
  let posts: Array<{ slug: string; updated_at: string | null }> | null = null;
  try {
    const sb = anonClient();
    [{ data: jobs }, { data: posts }] = await Promise.all([
      sb.from('jobs').select('slug, updated_at').eq('status', 'open'),
      sb.from('posts').select('slug, updated_at').eq('status', 'published'),
    ]);
  } catch { /* static URLs only */ }

  const urls: string[] = [];
  for (const [path, freq] of STATIC) {
    urls.push(`<url><loc>${SITE}${path}</loc><changefreq>${freq}</changefreq></url>`);
  }
  for (const j of jobs ?? []) {
    urls.push(`<url><loc>${SITE}/careers/${j.slug}</loc>${lastmod(j.updated_at)}<changefreq>weekly</changefreq></url>`);
  }
  for (const p of posts ?? []) {
    urls.push(`<url><loc>${SITE}/blog/${p.slug}</loc>${lastmod(p.updated_at)}<changefreq>monthly</changefreq></url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=3600' },
  });
};
