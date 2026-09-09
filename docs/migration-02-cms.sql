-- ============================================================
--  Vacant HR — CMS (المرحلة 5أ)
--  إعدادات الموقع + الآراء + الأسئلة + الأسعار + مكتبة الصور
--  آمن لإعادة التشغيل.
-- ============================================================

-- ---------- الجداول ----------

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '""'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text,
  quote text not null,
  position int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  position int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.pricing_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price text not null,
  unit text,
  note text,
  features jsonb not null default '[]'::jsonb,
  featured boolean not null default false,
  cta_label text default 'ابدأ الآن',
  position int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  alt text default '',
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

-- ---------- RLS ----------

alter table public.site_settings enable row level security;
alter table public.testimonials  enable row level security;
alter table public.faqs          enable row level security;
alter table public.pricing_plans enable row level security;
alter table public.media         enable row level security;

drop policy if exists "settings public read"  on public.site_settings;
drop policy if exists "settings admin write"  on public.site_settings;
create policy "settings public read" on public.site_settings for select using (true);
create policy "settings admin write" on public.site_settings for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "testimonials public read" on public.testimonials;
drop policy if exists "testimonials admin write" on public.testimonials;
create policy "testimonials public read" on public.testimonials for select using (published or public.is_admin());
create policy "testimonials admin write" on public.testimonials for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "faqs public read" on public.faqs;
drop policy if exists "faqs admin write" on public.faqs;
create policy "faqs public read" on public.faqs for select using (published or public.is_admin());
create policy "faqs admin write" on public.faqs for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "plans public read" on public.pricing_plans;
drop policy if exists "plans admin write" on public.pricing_plans;
create policy "plans public read" on public.pricing_plans for select using (published or public.is_admin());
create policy "plans admin write" on public.pricing_plans for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "media public read" on public.media;
drop policy if exists "media admin write" on public.media;
create policy "media public read" on public.media for select using (true);
create policy "media admin write" on public.media for all using (public.is_admin()) with check (public.is_admin());

-- ---------- bucket الصور (عام) ----------

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "media bucket public read" on storage.objects;
drop policy if exists "media bucket admin write" on storage.objects;
create policy "media bucket public read" on storage.objects for select
  using (bucket_id = 'media');
create policy "media bucket admin write" on storage.objects for insert
  with check (bucket_id = 'media' and public.is_admin());
create policy "media bucket admin delete" on storage.objects for delete
  using (bucket_id = 'media' and public.is_admin());

-- ---------- القيم الحالية كبداية ----------

insert into public.site_settings (key, value) values
  ('contact_email',    '"info@vacanthr.com"'),
  ('contact_phone',    '"+201000000000"'),
  ('whatsapp_number',  '"201000000000"'),
  ('address',          '"القاهرة، مصر"'),
  ('working_hours',    '"الأحد – الخميس، 9 صباحًا – 5 مساءً"'),
  ('linkedin_url',     '"https://www.linkedin.com/company/vacanthr"'),
  ('company_blurb',    '"حلول متكاملة للتوظيف وإدارة الموارد البشرية للشركات الناشئة والمتوسطة."'),
  ('home_hero_eyebrow','"شريكك في إدارة رأس المال البشري"'),
  ('home_hero_title',  '"نبني أنظمة التوظيف والموارد البشرية التي تكبر مع شركتك"'),
  ('home_hero_lead',   '"من إيجاد الكفاءة المناسبة، إلى إدارة بيانات موظفيك يوميًا، وصولًا لهيكلة سياسات عملك — Vacant HR تجمع الخدمة البشرية والتقنية في مكان واحد."'),
  ('home_stats',       '[{"value":"+120","label":"شركة تثق بينا"},{"value":"+3,400","label":"توظيف ناجح"},{"value":"18","label":"قطاع مختلف"},{"value":"92%","label":"نسبة رضا العملاء"}]')
on conflict (key) do nothing;

insert into public.testimonials (name, title, quote, position) values
  ('منال إبراهيم','مديرة الموارد البشرية — شركة تقنية','فريق Vacant HR فهم طبيعة شركتنا بسرعة، ورشحلنا 3 مرشحين كلهم كانوا مناسبين فعلًا. عيّنّا واحد خلال أسبوعين.',1),
  ('أحمد فؤاد','مدير عمليات — سلسلة مطاعم','نقلنا إدارة الحضور والرواتب من شيتات إكسل لبرنامج HRM بتاعهم. وفّرنا يومين شغل كل شهر على الأقل.',2),
  ('سارة عبد الله','مؤسِّسة — شركة خدمات لوجستية','الاستشارة كانت عملية جدًا. طلعنا بدليل سياسات واضح وهيكل تنظيمي مفيش فيه تضارب صلاحيات.',3)
on conflict do nothing;

insert into public.faqs (question, answer, position) values
  ('خدمة التوظيف بتاخد وقت قد إيه؟','في المتوسط بنقدّم قائمة مختصرة من 3–5 مرشحين خلال 7–10 أيام عمل من تأكيد تفاصيل الدور، والتعيين النهائي بيتم عادةً خلال 3–4 أسابيع.',1),
  ('برنامج HRM بيشتغل على الموبايل؟','أيوه، النظام سحابي بالكامل ويشتغل من المتصفح على الكمبيوتر والموبايل، وفيه تسجيل حضور عن طريق الموبايل أو البصمة.',2),
  ('هل في حد أدنى لعدد الموظفين للاشتراك في البرنامج؟','لا يوجد حد أدنى إلزامي. الباقة الأساسية مصممة للفرق تحت 20 موظف، وفيه باقات أكبر للشركات المتوسطة والمؤسسات.',3),
  ('نماذج الوصف الوظيفي مجانية فعلًا؟','أيوه، مكتبة النماذج القياسية متاحة للتحميل مجانًا. لو محتاج نموذج مخصص لمسمى غير موجود، بنجهّزه لك خلال يوم عمل.',4)
on conflict do nothing;

insert into public.pricing_plans (name, price, unit, note, features, featured, cta_label, position) values
  ('أساسي','150 ج.م','/ موظف / شهريًا','لفرق تحت 20 موظف',
   '["الحضور والانصراف","إدارة الإجازات","دعم عبر البريد الإلكتروني"]', false, 'ابدأ الآن', 1),
  ('احترافي','220 ج.م','/ موظف / شهريًا','الأكثر طلبًا للشركات المتوسطة',
   '["كل مميزات الباقة الأساسية","إدارة الرواتب الكاملة","تقييم الأداء","دعم فني مباشر"]', true, 'اطلب عرض تجريبي', 2),
  ('مؤسسي','تواصل معنا',null,'لفرق أكبر من 100 موظف',
   '["كل المميزات","تكامل مع أنظمة أخرى (API)","مدير حساب مخصص"]', false, 'تواصل مع المبيعات', 3)
on conflict do nothing;

-- ============================================================
--  تم.
-- ============================================================
