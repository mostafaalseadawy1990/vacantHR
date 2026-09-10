-- ============================================================
--  Vacant HR — تحليلات داخلية + مقابلات + رسائل (المرحلة 6)
--  آمن لإعادة التشغيل. شغّل القطع واحدة واحدة لو المحرر بيضيف أقواس.
-- ============================================================

-- ---------- 1) أحداث الزوار (تحليلات first-party) ----------
create table if not exists public.events (
  id bigint generated always as identity primary key,
  kind text not null,
  path text,
  ref text,
  day date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now()
);
create index if not exists events_day_idx on public.events (day, kind);
alter table public.events enable row level security;
drop policy if exists "events admin read" on public.events;
create policy "events admin read" on public.events for select using (public.is_admin());

create or replace function public.track_event(kind text, path text default null, ref text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.events (kind, path, ref)
  values (left(coalesce(kind,'pageview'),32), left(path,255), left(ref,128));
end $$;
grant execute on function public.track_event(text,text,text) to anon, authenticated;

-- ---------- 2) المقابلات ----------
create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  scheduled_at timestamptz not null,
  mode text not null default 'online',
  location text,
  notes text,
  status text not null default 'proposed',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.interviews drop constraint if exists interviews_mode_chk;
alter table public.interviews add constraint interviews_mode_chk check (mode in ('online','onsite','phone'));
alter table public.interviews drop constraint if exists interviews_status_chk;
alter table public.interviews add constraint interviews_status_chk check (status in ('proposed','confirmed','completed','cancelled'));
create index if not exists interviews_app_idx on public.interviews (application_id, scheduled_at);
alter table public.interviews enable row level security;
drop policy if exists "interviews admin all" on public.interviews;
create policy "interviews admin all" on public.interviews for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "interviews candidate read" on public.interviews;
create policy "interviews candidate read" on public.interviews for select
  using (application_id in (select id from public.applications where candidate_id = auth.uid()));

-- ---------- 3) الرسائل الداخلية ----------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null default 'محادثة',
  application_id uuid references public.applications(id) on delete set null,
  request_id uuid references public.client_requests(id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists conv_part_idx on public.conversations (participant_id, last_message_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists msg_conv_idx on public.messages (conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "conv read" on public.conversations;
create policy "conv read" on public.conversations for select using (participant_id = auth.uid() or public.is_admin());
drop policy if exists "conv admin write" on public.conversations;
create policy "conv admin write" on public.conversations for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "msg read" on public.messages;
create policy "msg read" on public.messages for select
  using (conversation_id in (select id from public.conversations where participant_id = auth.uid() or public.is_admin()));
drop policy if exists "msg insert" on public.messages;
create policy "msg insert" on public.messages for insert
  with check (sender_id = auth.uid() and conversation_id in (select id from public.conversations where participant_id = auth.uid() or public.is_admin()));

create or replace function public.touch_conversation() returns trigger language plpgsql as $$
begin update public.conversations set last_message_at = now() where id = new.conversation_id; return new; end $$;
drop trigger if exists msg_touch on public.messages;
create trigger msg_touch after insert on public.messages for each row execute function public.touch_conversation();

-- ============================================================
--  تم.
-- ============================================================
