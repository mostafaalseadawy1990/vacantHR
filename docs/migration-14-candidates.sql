-- ============================================================
--  Vacant HR — إثراء بيانات المرشحين. آمن لإعادة التشغيل.
-- ============================================================

alter table public.profiles
  add column if not exists headline        text,          -- المسمى المهني الحالي "محاسب أول"
  add column if not exists city            text,
  add column if not exists years_experience int,
  add column if not exists education       text,          -- أعلى مؤهل
  add column if not exists current_company text,
  add column if not exists expected_salary int,
  add column if not exists availability    text check (availability in ('immediate','2weeks','1month','2months','not_looking')),
  add column if not exists linkedin_url    text,
  add column if not exists portfolio_url   text,
  add column if not exists birth_year      int,
  add column if not exists bio             text,          -- نبذة قصيرة يكتبها المرشح
  add column if not exists cv_path         text,          -- سيرة ذاتية عامة على الملف (bucket: cvs)
  add column if not exists tags            text[] not null default '{}',   -- وسوم داخلية للفريق
  add column if not exists admin_notes     text,          -- ملاحظات داخلية على المرشح نفسه
  add column if not exists source          text,          -- من فين جه (linkedin, referral, website...)
  add column if not exists updated_at      timestamptz not null default now();

create index if not exists profiles_city_idx on public.profiles (city);
create index if not exists profiles_tags_idx on public.profiles using gin (tags);
create index if not exists profiles_skills_idx on public.profiles using gin (skills);

-- الفريق (مدير/مسؤول توظيف) يقدر يعدّل بيانات المرشحين والعملاء. تغيير الدور للمدير فقط.
drop policy if exists "staff updates profiles" on public.profiles;
create policy "staff updates profiles" on public.profiles for update
  using (public.has_role('admin','recruiter'))
  with check (public.has_role('admin') or role in ('candidate','client'));

-- الفريق يقرأ السير الذاتية (كان admin فقط)
drop policy if exists "candidate reads own cv" on storage.objects;
create policy "candidate reads own cv" on storage.objects for select
  using (bucket_id = 'cvs' and ((storage.foldername(name))[1] = auth.uid()::text or public.has_role('admin','recruiter','viewer')));
