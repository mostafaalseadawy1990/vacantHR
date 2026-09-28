import type { APIRoute } from 'astro';
import { can, canWrite } from '../../../../lib/roles';
import { serverClient } from '../../../../lib/supabase';
import { logAction } from '../../../../lib/audit';

export const prerender = false;

const VALID = ['submitted', 'reviewing', 'shortlisted', 'rejected', 'hired'];

export const POST: APIRoute = async (context) => {
  if (!can(context.locals.profile?.role, 'candidates') || !canWrite(context.locals.profile?.role)) {
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
  await logAction(context, supabase, `تغيير حالة متقدم إلى ${status}`, context.params.id);
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};
