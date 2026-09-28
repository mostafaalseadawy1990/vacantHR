-- ============================================================
--  Vacant HR — تحليلات أغنى: نوع الجهاز + حملات UTM. آمن لإعادة التشغيل.
-- ============================================================
alter table public.events
  add column if not exists device text,          -- mobile / desktop
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text;

create or replace function public.track_event(
  kind text, path text default null, ref text default null,
  device text default null, utm_source text default null, utm_medium text default null, utm_campaign text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.events (kind, path, ref, device, utm_source, utm_medium, utm_campaign)
  values (left(coalesce(kind,'pageview'),32), left(path,255), left(ref,128),
          left(device,16), left(utm_source,64), left(utm_medium,64), left(utm_campaign,64));
end $$;
grant execute on function public.track_event(text,text,text,text,text,text,text) to anon, authenticated;
