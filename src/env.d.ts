/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

type ProfileRole = 'candidate' | 'client' | 'admin';

declare namespace App {
  interface Locals {
    user: import('@supabase/supabase-js').User | null;
    profile: {
      id: string;
      role: ProfileRole;
      full_name: string | null;
      phone: string | null;
      company_name: string | null;
      skills: string[] | null;
    } | null;
  }
}
