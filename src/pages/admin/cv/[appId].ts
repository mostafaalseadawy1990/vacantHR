import type { APIRoute } from 'astro';
import { serverClient } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  if (context.locals.profile?.role !== 'admin') {
    return new Response('غير مصرّح', { status: 403 });
  }
  const supabase = serverClient(context);
  const { data: app } = await supabase
    .from('applications')
    .select('cv_path')
    .eq('id', context.params.appId)
    .maybeSingle();

  if (!app?.cv_path) return new Response('الملف غير موجود', { status: 404 });

  const { data, error } = await supabase.storage.from('cvs').createSignedUrl(app.cv_path, 600);
  if (error || !data?.signedUrl) return new Response('تعذّر إنشاء الرابط', { status: 500 });

  return context.redirect(data.signedUrl, 302);
};
