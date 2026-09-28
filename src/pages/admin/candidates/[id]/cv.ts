import type { APIRoute } from 'astro';
import { can } from '../../../../lib/roles';
import { serverClient } from '../../../../lib/supabase';

export const prerender = false;

/** Signed link to the CV stored on the candidate's profile (not an application). */
export const GET: APIRoute = async (context) => {
  if (!can(context.locals.profile?.role, 'candidates')) return new Response('غير مصرّح', { status: 403 });
  const supabase = serverClient(context);
  const { data: p } = await supabase.from('profiles').select('cv_path').eq('id', context.params.id).maybeSingle();
  if (!p?.cv_path) return new Response('الملف غير موجود', { status: 404 });
  const { data, error } = await supabase.storage.from('cvs').createSignedUrl(p.cv_path, 600);
  if (error || !data?.signedUrl) return new Response('تعذّر إنشاء الرابط', { status: 500 });
  return context.redirect(data.signedUrl, 302);
};
