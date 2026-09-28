-- ============================================================
--  Vacant HR — الصفحة الرئيسية وتواصل معنا كأقسام قابلة للتعديل + رسائل الموقع. آمن لإعادة التشغيل.
-- ============================================================

-- 1) أنواع أقسام إضافية (بطاقات، آراء، أسئلة، وظائف، مقالات)
alter table public.site_sections drop constraint if exists site_sections_kind_check;
alter table public.site_sections add constraint site_sections_kind_check
  check (kind in ('hero','feature','steps','rich','cta','stats','pricing','cards','testimonials','faqs','jobs','posts'));

-- 2) رسائل نموذج "تواصل معنا" (بدل خدمة خارجية)
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  email text not null,
  phone text,
  service text,
  message text not null,
  source text,                 -- الصفحة اللي اتبعت منها
  status text not null default 'new' check (status in ('new','handled')),
  note text,                   -- ملاحظة داخلية
  created_at timestamptz not null default now()
);
create index if not exists contact_messages_idx on public.contact_messages (status, created_at desc);
alter table public.contact_messages enable row level security;
drop policy if exists "contact staff read" on public.contact_messages;
create policy "contact staff read" on public.contact_messages for select using (public.has_role('admin','recruiter','support'));
drop policy if exists "contact staff update" on public.contact_messages;
create policy "contact staff update" on public.contact_messages for update using (public.has_role('admin','recruiter','support'));
drop policy if exists "contact staff delete" on public.contact_messages;
create policy "contact staff delete" on public.contact_messages for delete using (public.has_role('admin'));

-- الزائر بيبعت من غير تسجيل دخول عبر الدالة دي
create or replace function public.submit_contact(
  p_name text, p_email text, p_message text, p_company text default null, p_phone text default null, p_service text default null, p_source text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.contact_messages (name, email, message, company, phone, service, source)
  values (left(p_name,120), left(p_email,200), left(p_message,4000), left(p_company,120), left(p_phone,40), left(p_service,80), left(p_source,120));
end $$;
grant execute on function public.submit_contact(text,text,text,text,text,text,text) to anon, authenticated;
