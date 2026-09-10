-- ============================================================
--  Vacant HR — مهارات الوظائف والمرشحين (للمطابقة). آمن لإعادة التشغيل.
-- ============================================================

alter table public.jobs     add column if not exists skills text[] not null default '{}';
alter table public.profiles add column if not exists skills text[] not null default '{}';

-- ============================================================
