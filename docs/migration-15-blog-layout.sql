-- ============================================================
--  Vacant HR — تصنيفات المقالات + اسم الكاتب (لتنظيم المدوّنة). آمن لإعادة التشغيل.
--  إعدادات شكل المدوّنة نفسها بتتحفظ في site_settings (مفتاح blog_layout) — مفيش جدول جديد.
-- ============================================================
alter table public.posts add column if not exists category text;
alter table public.posts add column if not exists author_name text;
create index if not exists posts_category_idx on public.posts (category);
