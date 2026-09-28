import type { APIRoute } from 'astro';
import { getJdTemplate } from '../../lib/jd';
import { htmlToDocx } from '../../lib/docx';
import { anonClient } from '../../lib/supabase';

export const prerender = false;

/** Downloads a job-description template as a Word document. */
export const GET: APIRoute = async ({ params }) => {
  const t = await getJdTemplate(String(params.slug));
  if (!t) return new Response('غير موجود', { status: 404 });
  try { await anonClient().rpc('jd_download', { t_slug: t.slug }); } catch { /* counter is best-effort */ }
  const bytes = htmlToDocx(t.body_html, { title: `نموذج وصف وظيفي — ${t.title}`, footer: 'نموذج من إعداد Vacant HR — vacanthr.com. عدّل ما بين [ ] بما يناسب شركتك.' });
  const name = encodeURIComponent(`${t.title}.docx`);
  return new Response(bytes, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${t.slug}.docx"; filename*=UTF-8''${name}`,
      'Cache-Control': 'no-store',
    },
  });
};
