import type { APIRoute } from 'astro';
import { serverClient } from '../../../lib/supabase';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) return new Response(JSON.stringify({ error: 'auth' }), { status: 401 });

  let action = 'save';
  try {
    action = String((await context.request.json())?.action || 'save');
  } catch { /* ignore */ }

  const supabase = serverClient(context);
  const { data: job } = await supabase.from('jobs').select('id').eq('slug', context.params.slug).maybeSingle();
  if (!job) return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });

  if (action === 'unsave') {
    await supabase.from('saved_jobs').delete().eq('candidate_id', user.id).eq('job_id', job.id);
  } else {
    await supabase.from('saved_jobs').upsert({ candidate_id: user.id, job_id: job.id });
  }
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};
