# إعداد Supabase — Vacant HR

خطوات لمرة واحدة. نفّذها بحسابك، وبعدها ابعتلي `Project URL` و `anon key`.

## 1) إنشاء المشروع

1. [supabase.com](https://supabase.com) ← **New project**
2. الاسم: `vacanthr` — Region: **Frankfurt (eu-central-1)** (أقرب لمصر)
3. اختَر Database Password قوي واحفظه
4. استنى ~دقيقتين لحد ما المشروع يجهز

## 2) تنفيذ سكربت قاعدة البيانات

من القائمة الجانبية: **SQL Editor** ← **New query** ← الصق كل المحتوى تحت ← **Run**.

```sql
-- ============ الجداول ============

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'candidate' check (role in ('candidate','client','admin')),
  full_name text,
  phone text,
  company_name text,
  created_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  department text,
  location text default 'القاهرة، مصر',
  employment_type text default 'full_time' check (employment_type in ('full_time','part_time','contract','temporary')),
  workplace text default 'onsite' check (workplace in ('onsite','hybrid','remote')),
  experience_level text,
  salary_min int,
  salary_max int,
  salary_currency text default 'EGP',
  salary_visible boolean not null default false,
  description_md text not null default '',
  requirements_md text not null default '',
  status text not null default 'draft' check (status in ('draft','open','closed')),
  client_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);
create index jobs_status_idx on public.jobs (status, published_at desc);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  cv_path text,
  cover_note text,
  status text not null default 'submitted' check (status in ('submitted','reviewing','shortlisted','rejected','hired')),
  created_at timestamptz not null default now(),
  unique (job_id, candidate_id)
);
create index applications_candidate_idx on public.applications (candidate_id, created_at desc);
create index applications_job_idx on public.applications (job_id, created_at desc);

create table public.client_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  role_title text not null,
  details_md text default '',
  headcount int not null default 1,
  status text not null default 'new' check (status in ('new','in_progress','candidates_sent','closed')),
  created_at timestamptz not null default now()
);

-- ============ إنشاء profile تلقائيًا عند التسجيل ============

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, full_name, phone, company_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'candidate'),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'company_name'
  );
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ دالة مساعدة: هل المستخدم أدمن؟ ============

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ============ RLS ============

alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.client_requests enable row level security;

-- profiles
create policy "read own profile" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "update own profile" on public.profiles for update using (id = auth.uid());

-- jobs
create policy "public reads open jobs" on public.jobs for select using (status = 'open' or public.is_admin() or client_id = auth.uid());
create policy "admin writes jobs" on public.jobs for all using (public.is_admin()) with check (public.is_admin());

-- applications
create policy "candidate inserts own application" on public.applications for insert with check (candidate_id = auth.uid());
create policy "candidate reads own applications" on public.applications for select using (candidate_id = auth.uid() or public.is_admin());
create policy "admin updates applications" on public.applications for update using (public.is_admin());

-- client_requests
create policy "client inserts own request" on public.client_requests for insert with check (client_id = auth.uid());
create policy "client reads own requests" on public.client_requests for select using (client_id = auth.uid() or public.is_admin());
create policy "admin updates client requests" on public.client_requests for update using (public.is_admin());
```

## 3) إنشاء bucket لتخزين السير الذاتية

**Storage** ← **New bucket** ← الاسم: `cvs` ← **Private** (مش public) ← Create.

بعدين **Storage** ← **Policies** ← على bucket `cvs` أضف:

```sql
-- المرشح يرفع في مجلد باسم user id بتاعه
create policy "candidate uploads own cv" on storage.objects for insert
  with check (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "candidate reads own cv" on storage.objects for select
  using (bucket_id = 'cvs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
```

## 4) إعدادات المصادقة (Auth)

**Authentication** ← **Providers**:
- **Email**: مفعّل. لو عايز تجربة أسرع، فعّل مؤقتًا **"Confirm email = OFF"** (رجّعه ON قبل الإطلاق).
- **Google** (اختياري): فعّله وحط Client ID/Secret من Google Cloud Console.

**Authentication** ← **URL Configuration**:
- Site URL: `https://vacanthr.com`
- Redirect URLs: أضف `https://vacanthr.com/**` و `http://localhost:4321/**`

## 5) تعيين نفسك أدمن

بعد ما تعمل حساب على الموقع بإيميلك، نفّذ في SQL Editor:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'mostafaalseadawy1990@gmail.com');
```

## 6) المفاتيح اللي محتاجها

**Project Settings** ← **API**:
- `Project URL` → متغير `PUBLIC_SUPABASE_URL`
- `anon` `public` key → متغير `PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key → **سري** — هيتحط في Cloudflare Pages كـ `SUPABASE_SERVICE_ROLE` (مايتلمسش في الكود ولا يترفع على GitHub)

ابعتلي أول اتنين وأنا أكمّل الربط.
