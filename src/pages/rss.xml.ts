import type { APIRoute } from 'astro';
import { getPosts } from '../lib/settings';

export const prerender = false;
const SITE = 'https://vacanthr.com';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: APIRoute = async () => {
  const posts = await getPosts();
  const items = posts.map((p) => `
    <item>
      <title>${esc(p.title)}</title>
      <link>${SITE}/blog/${p.slug}</link>
      <guid>${SITE}/blog/${p.slug}</guid>
      <pubDate>${new Date(p.published_at ?? p.created_at).toUTCString()}</pubDate>
      <description>${esc(p.excerpt || '')}</description>
    </item>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>مدوّنة Vacant HR</title>
  <link>${SITE}/blog</link>
  <description>مقالات في التوظيف وإدارة الموارد البشرية</description>
  <language>ar</language>${items}
</channel></rss>`;
  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=3600' },
  });
};
