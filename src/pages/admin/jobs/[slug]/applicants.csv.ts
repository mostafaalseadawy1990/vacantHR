import type { APIRoute } from 'astro';
import { serverClient } from '../../../../lib/supabase';
import { toCsv, csvResponse } from '../../../../lib/csv';

export const prerender = false;

const STATUS_AR: Record<string, string> = {
  submitted: 'تحت المراجعة', reviewing: 'قيد الفحص', shortlisted: 'قائمة مختصرة',
  rejected: 'مرفوض', hired: 'تم التعيين',
};

export const GET: APIRoute = async (context) => {
  if (context.locals.profile?.role !== 'admin') return new Response('غير مصرّح', { status: 403 });

  const supabase = serverClient(context);
  const { slug } = context.params;

  const { data: job } = await supabase.from('jobs').select('id, title').eq('slug', slug).maybeSingle();
  if (!job) return new Response('الوظيفة غير موجودة', { status: 404 });

  const { data, error } = await supabase
    .from('applications')
    .select('status, rating, created_at, cover_note, profiles(full_name, email, phone)')
    .eq('job_id', job.id)
    .order('created_at', { ascending: false });
  if (error) return new Response(error.message, { status: 500 });

  const csv = toCsv(
    ['الاسم', 'الإيميل', 'الهاتف', 'الحالة', 'التقييم', 'تاريخ التقديم', 'نبذة'],
    (data ?? []).map((r: any) => [
      r.profiles?.full_name ?? '',
      r.profiles?.email ?? '',
      r.profiles?.phone ?? '',
      STATUS_AR[r.status] ?? r.status,
      r.rating ?? '',
      (r.created_at ?? '').slice(0, 10),
      (r.cover_note ?? '').replace(/\s+/g, ' ').trim(),
    ]),
  );
  const safe = String(slug).replace(/[^a-z0-9-]/gi, '') || 'job';
  return csvResponse(`vacanthr-${safe}-applicants.csv`, csv);
};
