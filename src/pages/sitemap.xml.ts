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
  ['/careers', 'daily'],
  ['/blog', 'weekly'],
  ['/about', 'yearly'],
  ['/contact', 'yearly'],
  ['/privacy', 'yearly'],
];

export const GET: APIRoute = async () => {
  const sb = anonClient();
  const [{ data: jobs }, { data: posts }] = await Promise.all([
    sb.from('jobs').select('slug, updated_at').eq('status', 'open'),
    sb.from('posts').select('slug, updated_at').eq('status', 'published'),
  ]);

  const urls: string[] = [];
  for (const [path, freq] of STATIC) {
    urls.push(`<url><loc>${SITE}${path}</loc><changefreq>${freq}</changefreq></url>`);
  }
  for (const j of jobs ?? []) {
    urls.push(`<url><loc>${SITE}/careers/${j.slug}</loc><lastmod>${(j.updated_at ?? '').slice(0, 10)}</lastmod><changefreq>weekly</changefreq></url>`);
  }
  for (const p of posts ?? []) {
    urls.push(`<url><loc>${SITE}/blog/${p.slug}</loc><lastmod>${(p.updated_at ?? '').slice(0, 10)}</lastmod><changefreq>monthly</changefreq></url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=3600' },
  });
};
