-- ============================================================
--  Vacant HR — المحرّر المرئي + الصفحات المخصّصة. آمن لإعادة التشغيل.
--  - posts.body_html: محتوى المقال من المحرّر المرئي (body_md بيفضل للمقالات القديمة)
--  - pages: صفحات حرّة (مثل /about-us أو /services) بتتكتب من لوحة الإدارة وتظهر على /<slug>
-- ============================================================

alter table public.posts add column if not exists body_html text not null default '';

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text not null default '',
  body_html text not null default '',
  status text not null default 'draft' check (status in ('draft','published')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pages enable row level security;
drop policy if exists "pages public read" on public.pages;
drop policy if exists "pages admin write" on public.pages;
create policy "pages public read" on public.pages
  for select using (status = 'published' or public.is_admin());
create policy "pages admin write" on public.pages
  for all using (public.is_admin()) with check (public.is_admin());
