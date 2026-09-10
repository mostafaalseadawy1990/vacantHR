import type { APIRoute } from 'astro';
import { anonClient } from '../lib/supabase';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const b = await request.json();
    let ref = '';
    try { ref = b.ref ? new URL(b.ref).host : ''; } catch { ref = ''; }
    await anonClient().rpc('track_event', {
      kind: String(b.kind || 'pageview').slice(0, 32),
      path: String(b.path || '').slice(0, 255),
      ref: ref.slice(0, 128),
    });
  } catch { /* analytics is best-effort */ }
  return new Response(null, { status: 204 });
};
