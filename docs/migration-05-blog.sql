-- ============================================================
--  Vacant HR — مدونة + عدّاد مشاهدات الوظائف (المرحلة 5ج)
--  آمن لإعادة التشغيل.
-- ============================================================

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  excerpt text not null default '',
  cover_path text,
  body_md text not null default '',
  tags text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','published')),
  author_id uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists posts_pub_idx on public.posts (status, published_at desc);

alter table public.posts enable row level security;
drop policy if exists "posts public read" on public.posts;
drop policy if exists "posts admin write" on public.posts;
create policy "posts public read" on public.posts
  for select using (status = 'published' or public.is_admin());
create policy "posts admin write" on public.posts
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- عدّاد مشاهدات الوظائف ----------

create table if not exists public.job_views (
  job_id uuid not null references public.jobs(id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  count int not null default 0,
  primary key (job_id, day)
);
alter table public.job_views enable row level security;
drop policy if exists "job_views admin read" on public.job_views;
create policy "job_views admin read" on public.job_views
  for select using (public.is_admin());

create or replace function public.bump_job_view(job uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.job_views (job_id, day, count)
  values (job, (now() at time zone 'utc')::date, 1)
  on conflict (job_id, day) do update set count = public.job_views.count + 1;
end $$;
grant execute on function public.bump_job_view(uuid) to anon, authenticated;

-- ============================================================
--  تم.
-- ============================================================
