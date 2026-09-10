import type { APIRoute } from 'astro';
import { serverClient } from '../../lib/supabase';
import { toCsv, csvResponse } from '../../lib/csv';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  if (context.locals.profile?.role !== 'admin') return new Response('غير مصرّح', { status: 403 });

  const supabase = serverClient(context);
  const q = (context.url.searchParams.get('q') || '').trim();

  let query = supabase
    .from('profiles')
    .select('full_name, email, phone, created_at, applications(count)')
    .eq('role', 'candidate')
    .order('created_at', { ascending: false })
    .limit(5000);

  if (q) {
    const like = `%${q}%`;
    query = query.or(`full_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`);
  }

  const { data, error } = await query;
  if (error) return new Response(error.message, { status: 500 });

  const csv = toCsv(
    ['الاسم', 'الإيميل', 'الهاتف', 'عدد الطلبات', 'تاريخ التسجيل'],
    (data ?? []).map((r: any) => [
      r.full_name ?? '',
      r.email ?? '',
      r.phone ?? '',
      r.applications?.[0]?.count ?? 0,
      (r.created_at ?? '').slice(0, 10),
    ]),
  );
  return csvResponse(`vacanthr-candidates-${new Date().toISOString().slice(0, 10)}.csv`, csv);
};
