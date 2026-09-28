import type { APIRoute } from 'astro';
import { can } from '../../../lib/roles';
import { serverClient } from '../../../lib/supabase';
import { mediaUrl } from '../../../lib/settings';

export const prerender = false;

const MAX = 4 * 1024 * 1024;
const OK = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'];

/** Image upload for the rich-text editor. Returns { url } (also registers the file in the media library). */
export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user || !can(context.locals.profile?.role, 'media')) return json({ error: 'unauthorized' }, 401);

  const form = await context.request.formData();
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return json({ error: 'اختَر ملف صورة.' }, 400);
  if (file.size > MAX) return json({ error: 'حجم الصورة أكبر من 4 ميجابايت.' }, 400);
  if (!OK.includes(file.type)) return json({ error: 'الصيغة غير مدعومة (PNG / JPG / WEBP / SVG / GIF).' }, 400);

  const supabase = serverClient(context);
  const clean = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/-+/g, '-');
  const path = `${Date.now()}-${clean}`;
  const up = await supabase.storage.from('media').upload(path, file, { contentType: file.type });
  if (up.error) return json({ error: `تعذّر الرفع: ${up.error.message}` }, 500);
  await supabase.from('media').insert({ path, alt: String(form.get('alt') || '').trim(), created_by: user.id });
  return json({ url: mediaUrl(path), path });
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
