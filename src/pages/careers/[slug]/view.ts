import type { APIRoute } from 'astro';
import { anonClient } from '../../../lib/supabase';

export const prerender = false;

export const POST: APIRoute = async ({ params }) => {
  const sb = anonClient();
  const { data: job } = await sb.from('jobs').select('id').eq('slug', params.slug).eq('status', 'open').maybeSingle();
  if (job?.id) await sb.rpc('bump_job_view', { job: job.id });
  return new Response(null, { status: 204 });
};
