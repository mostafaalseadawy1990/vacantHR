import type { APIRoute } from 'astro';
import { can } from '../../lib/roles';
import { serverClient } from '../../lib/supabase';
import { toCsv, csvResponse } from '../../lib/csv';
import { AVAILABILITY_AR, SOURCE_AR } from '../../lib/candidates';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  if (!can(context.locals.profile?.role, 'candidates')) return new Response('غير مصرّح', { status: 403 });

  const supabase = serverClient(context);
  const q = (context.url.searchParams.get('q') || '').trim();

  let query = supabase
    .from('profiles')
    .select('full_name, email, phone, headline, city, years_experience, education, current_company, expected_salary, availability, linkedin_url, skills, tags, source, cv_path, created_at, applications(count)')
    .eq('role', 'candidate')
    .order('created_at', { ascending: false })
    .limit(5000);

  if (q) {
    const like = `%${q}%`;
    query = query.or(`full_name.ilike.${like},email.ilike.${like},phone.ilike.${like},headline.ilike.${like}`);
  }
  const P = (k: string) => (context.url.searchParams.get(k) || '').trim();
  if (P('skill')) query = query.contains('skills', [P('skill')]);
  if (P('tag')) query = query.contains('tags', [P('tag')]);
  if (P('city')) query = query.ilike('city', `%${P('city')}%`);
  if (P('availability')) query = query.eq('availability', P('availability'));
  if (P('min_exp')) query = query.gte('years_experience', parseInt(P('min_exp'), 10) || 0);
  if (P('has_cv') === '1') query = query.not('cv_path', 'is', null);

  const { data, error } = await query;
  if (error) return new Response(error.message, { status: 500 });

  const csv = toCsv(
    ['الاسم', 'الإيميل', 'الهاتف', 'المسمى', 'الشركة الحالية', 'المدينة', 'سنوات الخبرة', 'المؤهل', 'الراتب المتوقع', 'الجاهزية', 'المهارات', 'الوسوم', 'المصدر', 'LinkedIn', 'عنده CV', 'عدد الطلبات', 'تاريخ التسجيل'],
    (data ?? []).map((r: any) => [
      r.full_name ?? '', r.email ?? '', r.phone ?? '', r.headline ?? '', r.current_company ?? '', r.city ?? '',
      r.years_experience ?? '', r.education ?? '', r.expected_salary ?? '', AVAILABILITY_AR[r.availability] ?? '',
      (r.skills ?? []).join(' | '), (r.tags ?? []).join(' | '), SOURCE_AR[r.source] ?? r.source ?? '', r.linkedin_url ?? '',
      r.cv_path ? 'نعم' : 'لا', r.applications?.[0]?.count ?? 0, (r.created_at ?? '').slice(0, 10),
    ]),
  );
  return csvResponse(`vacanthr-candidates-${new Date().toISOString().slice(0, 10)}.csv`, csv);
};
