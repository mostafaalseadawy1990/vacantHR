-- ============================================================
--  Vacant HR — أقسام صفحات الموقع (التوظيف / برنامج HRM / الاستشارات / من نحن)
--  بتتعدل من لوحة الإدارة بالمحرّر. آمن لإعادة التشغيل.
-- ============================================================
create table if not exists public.site_sections (
  id uuid primary key default gen_random_uuid(),
  page text not null,                       -- recruitment | hrm-saas | consulting | about
  kind text not null check (kind in ('hero','feature','steps','rich','cta','stats','pricing')),
  eyebrow text,                             -- السطر الصغير فوق العنوان
  title text,
  body_html text not null default '',
  image_path text,                          -- من مكتبة الصور
  reverse boolean not null default false,   -- الصورة على الجهة الأخرى (feature)
  cta_label text, cta_href text,
  cta2_label text, cta2_href text,
  items jsonb not null default '[]',        -- للخطوات: [{"title":"..","body":".."}]
  position int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists site_sections_page_idx on public.site_sections (page, position);
alter table public.site_sections enable row level security;
drop policy if exists "sections public read" on public.site_sections;
create policy "sections public read" on public.site_sections for select using (published or public.has_role('admin','editor'));
drop policy if exists "sections editor write" on public.site_sections;
create policy "sections editor write" on public.site_sections for all
  using (public.has_role('admin','editor')) with check (public.has_role('admin','editor'));
