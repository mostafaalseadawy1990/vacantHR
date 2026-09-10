import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  // Surface misconfiguration early in build/dev logs.
  console.warn('[supabase] Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY');
}

/** Stateless client for public reads (open jobs, etc.). No user session. */
export function anonClient() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Request-scoped client bound to the Supabase auth cookie. Use in .astro / endpoints. */
export function serverClient(context: { request: Request; cookies: AstroCookies }) {
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return parseCookieHeader(context.request.headers.get('Cookie') ?? '');
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          context.cookies.set(name, value, options);
        });
      },
    },
  });
}

/** Returns the signed-in user's profile row, or null. */
export async function getSessionProfile(context: { request: Request; cookies: AstroCookies }) {
  const supabase = serverClient(context);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null, supabase };
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name, phone, company_name, skills')
    .eq('id', user.id)
    .single();
  return { user, profile, supabase };
}
