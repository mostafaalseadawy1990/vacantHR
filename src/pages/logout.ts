import type { APIRoute } from 'astro';
import { serverClient } from '../lib/supabase';

export const prerender = false;

const bye: APIRoute = async (context) => {
  const supabase = serverClient(context);
  await supabase.auth.signOut();
  return context.redirect('/', 303);
};

export const GET = bye;
export const POST = bye;
