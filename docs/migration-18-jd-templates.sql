-- ============================================================
--  Vacant HR — نماذج الوصف الوظيفي (تتعدل من لوحة الإدارة وتتنزّل Word). آمن لإعادة التشغيل.
-- ============================================================
create table if not exists public.jd_templates (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  sector text,                      -- القطاع: تقنية المعلومات / المبيعات / ...
  summary text not null default '',
  body_html text not null default '',
  downloads int not null default 0,
  position int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.jd_templates enable row level security;
drop policy if exists "jd public read" on public.jd_templates;
create policy "jd public read" on public.jd_templates for select using (published or public.has_role('admin','editor'));
drop policy if exists "jd editor write" on public.jd_templates;
create policy "jd editor write" on public.jd_templates for all
  using (public.has_role('admin','editor')) with check (public.has_role('admin','editor'));

-- عدّاد تنزيلات (يستدعيه الموقع بدون تسجيل دخول)
create or replace function public.jd_download(t_slug text) returns void
  language sql security definer set search_path = public as $$
  update public.jd_templates set downloads = downloads + 1 where slug = t_slug;
$$;
grant execute on function public.jd_download(text) to anon, authenticated;
