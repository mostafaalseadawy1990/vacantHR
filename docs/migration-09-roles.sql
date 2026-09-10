-- ============================================================
--  Vacant HR — سجل نشاط + دور "مسؤول توظيف" (المرحلة 7). آمن لإعادة التشغيل.
--  شغّل القطع واحدة واحدة.
-- ============================================================

-- ---------- 1) سجل النشاط ----------
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text,
  action text not null,
  target text,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_idx on public.audit_log (created_at desc);
alter table public.audit_log enable row level security;
drop policy if exists "audit admin read" on public.audit_log;
create policy "audit admin read" on public.audit_log for select using (public.is_admin());
drop policy if exists "audit staff write" on public.audit_log;
create policy "audit staff write" on public.audit_log for insert with check (auth.uid() is not null);

-- ---------- 2) السماح بدور recruiter ----------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('candidate','client','admin','recruiter'));

create or replace function public.is_staff() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','recruiter'));
$$;

-- ---------- 3) تحويل صلاحيات التشغيل من is_admin() إلى is_staff() ----------
-- (الإعدادات/المحتوى/الوسائط/المدونة/الدليل تفضل admin فقط)

drop policy if exists "admin writes jobs" on public.jobs;
create policy "staff writes jobs" on public.jobs for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "public reads open jobs" on public.jobs;
create policy "public reads open jobs" on public.jobs for select
  using (status = 'open' or public.is_staff() or client_id = auth.uid());

drop policy if exists "admin updates applications" on public.applications;
create policy "staff updates applications" on public.applications for update using (public.is_staff());
drop policy if exists "candidate reads own applications" on public.applications;
create policy "candidate reads own applications" on public.applications for select
  using (candidate_id = auth.uid() or public.is_staff());

drop policy if exists "notes admin all" on public.application_notes;
create policy "notes staff all" on public.application_notes for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "interviews admin all" on public.interviews;
create policy "interviews staff all" on public.interviews for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "admin updates client requests" on public.client_requests;
create policy "staff updates client requests" on public.client_requests for update using (public.is_staff());
drop policy if exists "client reads own requests" on public.client_requests;
create policy "client reads own requests" on public.client_requests for select
  using (client_id = auth.uid() or public.is_staff());

drop policy if exists "shortlist admin all" on public.client_shortlist;
create policy "shortlist staff all" on public.client_shortlist for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "conv read" on public.conversations;
create policy "conv read" on public.conversations for select using (participant_id = auth.uid() or public.is_staff());
drop policy if exists "conv admin write" on public.conversations;
create policy "conv staff write" on public.conversations for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "msg read" on public.messages;
create policy "msg read" on public.messages for select
  using (conversation_id in (select id from public.conversations where participant_id = auth.uid() or public.is_staff()));
drop policy if exists "msg insert" on public.messages;
create policy "msg insert" on public.messages for insert
  with check (sender_id = auth.uid() and conversation_id in (select id from public.conversations where participant_id = auth.uid() or public.is_staff()));

drop policy if exists "job_views admin read" on public.job_views;
create policy "job_views staff read" on public.job_views for select using (public.is_staff());

-- (اختياري) استعراض كل البروفايلات للموظفين
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select using (id = auth.uid() or public.is_staff());

-- ============================================================
--  تم.  بعد كده: من /admin/staff عيّن مستخدمين كـ recruiter.
-- ============================================================
