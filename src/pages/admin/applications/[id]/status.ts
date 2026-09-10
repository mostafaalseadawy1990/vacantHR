import type { APIRoute } from 'astro';
import { serverClient } from '../../../../lib/supabase';

export const prerender = false;

const VALID = ['submitted', 'reviewing', 'shortlisted', 'rejected', 'hired'];

export const POST: APIRoute = async (context) => {
  if (context.locals.profile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 });
  }
  let status = '';
  try {
    const ct = context.request.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      status = String((await context.request.json())?.status || '');
    } else {
      status = String((await context.request.formData()).get('status') || '');
    }
  } catch { /* ignore */ }

  if (!VALID.includes(status)) {
    return new Response(JSON.stringify({ error: 'bad status' }), { status: 400 });
  }

  const supabase = serverClient(context);
  const { error } = await supabase.from('applications').update({ status }).eq('id', context.params.id);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};
