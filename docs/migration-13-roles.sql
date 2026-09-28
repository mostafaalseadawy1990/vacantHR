-- ============================================================
--  Vacant HR — أدوار إضافية لفريق الإدارة. آمن لإعادة التشغيل.
--    admin      مدير: كل شيء
--    recruiter  مسؤول توظيف: وظائف/مرشحون/مقابلات/طلبات/رسائل
--    editor     محرّر محتوى: مدوّنة/صفحات/محتوى/وسائط
--    support    خدمة عملاء: طلبات الشركات + الرسائل
--    viewer     مشاهد: قراءة فقط
-- ============================================================

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('candidate','client','admin','recruiter','editor','support','viewer'));

-- هل المستخدم الحالي عنده أي دور من القائمة؟
create or replace function public.has_role(variadic roles text[]) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = any(roles));
$$;

-- is_staff(): أي عضو فريق (قراءة عامة داخل الإدارة)
create or replace function public.is_staff() returns boolean
  language sql stable security definer set search_path = public as $$
  select public.has_role('admin','recruiter','editor','support','viewer');
$$;

-- ---------- التوظيف: admin + recruiter يكتبوا ----------
drop policy if exists "staff writes jobs" on public.jobs;
create policy "staff writes jobs" on public.jobs for all
  using (public.has_role('admin','recruiter')) with check (public.has_role('admin','recruiter'));

drop policy if exists "staff updates applications" on public.applications;
create policy "staff updates applications" on public.applications for update using (public.has_role('admin','recruiter'));

drop policy if exists "notes staff all" on public.application_notes;
create policy "notes staff all" on public.application_notes for all
  using (public.has_role('admin','recruiter')) with check (public.has_role('admin','recruiter'));
drop policy if exists "notes staff read" on public.application_notes;
create policy "notes staff read" on public.application_notes for select using (public.is_staff());

drop policy if exists "interviews staff all" on public.interviews;
create policy "interviews staff all" on public.interviews for all
  using (public.has_role('admin','recruiter')) with check (public.has_role('admin','recruiter'));
drop policy if exists "interviews staff read" on public.interviews;
create policy "interviews staff read" on public.interviews for select using (public.is_staff());

-- ---------- العملاء: admin + recruiter + support ----------
drop policy if exists "staff updates client requests" on public.client_requests;
create policy "staff updates client requests" on public.client_requests for update
  using (public.has_role('admin','recruiter','support'));

drop policy if exists "shortlist staff all" on public.client_shortlist;
create policy "shortlist staff all" on public.client_shortlist for all
  using (public.has_role('admin','recruiter','support')) with check (public.has_role('admin','recruiter','support'));
drop policy if exists "shortlist staff read" on public.client_shortlist;
create policy "shortlist staff read" on public.client_shortlist for select using (public.is_staff());

drop policy if exists "conv staff write" on public.conversations;
create policy "conv staff write" on public.conversations for all
  using (public.has_role('admin','recruiter','support')) with check (public.has_role('admin','recruiter','support'));
drop policy if exists "conv read" on public.conversations;
create policy "conv read" on public.conversations for select
  using (participant_id = auth.uid() or public.has_role('admin','recruiter','support'));
drop policy if exists "msg read" on public.messages;
create policy "msg read" on public.messages for select
  using (conversation_id in (select id from public.conversations where participant_id = auth.uid() or public.has_role('admin','recruiter','support')));
drop policy if exists "msg insert" on public.messages;
create policy "msg insert" on public.messages for insert
  with check (sender_id = auth.uid() and conversation_id in (select id from public.conversations where participant_id = auth.uid() or public.has_role('admin','recruiter','support')));

-- ---------- المحتوى: admin + editor ----------
drop policy if exists "settings admin write" on public.site_settings;
create policy "settings admin write" on public.site_settings for all
  using (public.has_role('admin','editor')) with check (public.has_role('admin','editor'));
drop policy if exists "testimonials admin write" on public.testimonials;
create policy "testimonials admin write" on public.testimonials for all
  using (public.has_role('admin','editor')) with check (public.has_role('admin','editor'));
drop policy if exists "testimonials public read" on public.testimonials;
create policy "testimonials public read" on public.testimonials for select using (published or public.has_role('admin','editor'));
drop policy if exists "faqs admin write" on public.faqs;
create policy "faqs admin write" on public.faqs for all
  using (public.has_role('admin','editor')) with check (public.has_role('admin','editor'));
drop policy if exists "faqs public read" on public.faqs;
create policy "faqs public read" on public.faqs for select using (published or public.has_role('admin','editor'));
drop policy if exists "plans admin write" on public.pricing_plans;
create policy "plans admin write" on public.pricing_plans for all
  using (public.has_role('admin','editor')) with check (public.has_role('admin','editor'));
drop policy if exists "plans public read" on public.pricing_plans;
create policy "plans public read" on public.pricing_plans for select using (published or public.has_role('admin','editor'));
drop policy if exists "guide admin write" on public.guide_sections;
create policy "guide admin write" on public.guide_sections for all
  using (public.has_role('admin','editor')) with check (public.has_role('admin','editor'));
drop policy if exists "guide public read" on public.guide_sections;
create policy "guide public read" on public.guide_sections for select using (published or public.has_role('admin','editor'));
drop policy if exists "media admin write" on public.media;
create policy "media admin write" on public.media for all
  using (public.has_role('admin','editor')) with check (public.has_role('admin','editor'));
drop policy if exists "media bucket admin write" on storage.objects;
create policy "media bucket admin write" on storage.objects for insert
  with check (bucket_id = 'media' and public.has_role('admin','editor'));
drop policy if exists "media bucket admin delete" on storage.objects;
create policy "media bucket admin delete" on storage.objects for delete
  using (bucket_id = 'media' and public.has_role('admin','editor'));
drop policy if exists "posts admin write" on public.posts;
create policy "posts admin write" on public.posts for all
  using (public.has_role('admin','editor')) with check (public.has_role('admin','editor'));
drop policy if exists "posts public read" on public.posts;
create policy "posts public read" on public.posts for select using (status = 'published' or public.has_role('admin','editor'));
drop policy if exists "pages admin write" on public.pages;
create policy "pages admin write" on public.pages for all
  using (public.has_role('admin','editor')) with check (public.has_role('admin','editor'));
drop policy if exists "pages public read" on public.pages;
create policy "pages public read" on public.pages for select using (status = 'published' or public.has_role('admin','editor'));

-- ---------- التحليلات: admin + viewer ----------
drop policy if exists "events admin read" on public.events;
create policy "events admin read" on public.events for select using (public.has_role('admin','viewer'));

-- ---------- سجل النشاط: أي عضو يكتب، المدير يقرأ ----------
drop policy if exists "audit staff write" on public.audit_log;
create policy "audit staff write" on public.audit_log for insert with check (auth.uid() is not null);
alter table public.audit_log add column if not exists actor_role text;
create index if not exists audit_log_actor_idx on public.audit_log (actor_id, created_at desc);
