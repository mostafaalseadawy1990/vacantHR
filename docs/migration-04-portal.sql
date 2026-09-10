-- ============================================================
--  Vacant HR — بوابة العملاء (المرحلة 5ب – جزء 2)
--  قائمة مرشحين مقترحة لكل طلب توظيف + قرار العميل.
--  آمن لإعادة التشغيل.
-- ============================================================

create table if not exists public.client_shortlist (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.client_requests(id) on delete cascade,
  candidate_id uuid references public.profiles(id) on delete set null,
  headline text not null,
  summary text not null default '',
  admin_status text not null default 'draft' check (admin_status in ('draft','sent')),
  client_decision text not null default 'pending' check (client_decision in ('pending','approved','rejected')),
  client_note text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists client_shortlist_req_idx on public.client_shortlist (request_id, position);

alter table public.client_shortlist enable row level security;

drop policy if exists "shortlist admin all"   on public.client_shortlist;
drop policy if exists "shortlist client read" on public.client_shortlist;
create policy "shortlist admin all" on public.client_shortlist
  for all using (public.is_admin()) with check (public.is_admin());
create policy "shortlist client read" on public.client_shortlist
  for select using (
    admin_status = 'sent'
    and request_id in (select id from public.client_requests where client_id = auth.uid())
  );

-- قرار العميل عبر دالة محمية (يمنع تعديل باقي الأعمدة)
create or replace function public.client_decide_shortlist(item uuid, decision text, note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if decision not in ('approved','rejected') then
    raise exception 'decision must be approved or rejected';
  end if;
  update public.client_shortlist s
  set client_decision = decision,
      client_note = note,
      decided_at = now()
  where s.id = item
    and s.admin_status = 'sent'
    and s.request_id in (select id from public.client_requests where client_id = auth.uid());
  if not found then raise exception 'not allowed'; end if;
end $$;

grant execute on function public.client_decide_shortlist(uuid, text, text) to authenticated;

-- ============================================================
--  تم.
-- ============================================================
