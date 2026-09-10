-- ============================================================
--  Vacant HR — حفظ الوظائف (المرحلة 5د). آمن لإعادة التشغيل.
-- ============================================================

create table if not exists public.saved_jobs (
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (candidate_id, job_id)
);

alter table public.saved_jobs enable row level security;

drop policy if exists "saved own" on public.saved_jobs;
create policy "saved own" on public.saved_jobs
  for all using (candidate_id = auth.uid()) with check (candidate_id = auth.uid());

-- ============================================================
--  تم.
-- ============================================================
