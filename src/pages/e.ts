import type { APIRoute } from 'astro';
import { anonClient } from '../lib/supabase';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const b = await request.json();
    let ref = '';
    try { ref = b.ref ? new URL(b.ref).host : ''; } catch { ref = ''; }
    const sb = anonClient();
    const base = { kind: String(b.kind || 'pageview').slice(0, 32), path: String(b.path || '').slice(0, 255), ref: ref.slice(0, 128) };
    const extra = {
      device: b.device === 'mobile' ? 'mobile' : 'desktop',
      utm_source: String(b.utm_source || '').slice(0, 64) || null,
      utm_medium: String(b.utm_medium || '').slice(0, 64) || null,
      utm_campaign: String(b.utm_campaign || '').slice(0, 64) || null,
    };
    // Fall back to the 3-arg signature until docs/migration-16-analytics.sql has been applied.
    const { error } = await sb.rpc('track_event', { ...base, ...extra });
    if (error) await sb.rpc('track_event', base);
  } catch { /* analytics is best-effort */ }
  return new Response(null, { status: 204 });
};
