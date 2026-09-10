-- ============================================================
--  Vacant HR — ATS (المرحلة 5ب – جزء 1)
--  إيميل في البروفايل + تقييمات + ملاحظات على الطلبات.
--  آمن لإعادة التشغيل.
-- ============================================================

-- ---------- إيميل المستخدم داخل profiles (لقاعدة المرشحين) ----------

alter table public.profiles add column if not exists email text;

-- backfill من auth.users
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and (p.email is null or p.email = '');

-- خزّن الإيميل وقت التسجيل كمان
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, full_name, phone, company_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'candidate'),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'company_name',
    new.email
  )
  on conflict (id) do nothing;
  return new;
end; $$;

-- ---------- تقييم الطلب ----------

alter table public.applications
  add column if not exists rating smallint check (rating between 1 and 5);

-- ---------- ملاحظات داخلية على الطلب ----------

create table if not exists public.application_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists application_notes_app_idx
  on public.application_notes (application_id, created_at desc);

alter table public.application_notes enable row level security;

drop policy if exists "notes admin all" on public.application_notes;
create policy "notes admin all" on public.application_notes
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
--  تم.
-- ============================================================
