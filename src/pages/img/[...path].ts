import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * Same-origin image proxy for the Supabase `media` bucket.
 *  - Long immutable cache (uploads get unique timestamped names) → fixes "short cache lifetimes"
 *  - Cached at the Cloudflare edge through the Cache API, so Supabase is hit once per file
 *  - Optional resizing (?w=800) when the zone has Image Transformations enabled (IMAGE_RESIZE=1)
 */
export const GET: APIRoute = async ({ params, request, locals }) => {
  const path = (params.path || '').replace(/^\/+/, '');
  if (!path || path.includes('..')) return new Response('Not found', { status: 404 });
  const env = (locals as any)?.runtime?.env ?? {};
  const base = env.PUBLIC_SUPABASE_URL ?? import.meta.env.PUBLIC_SUPABASE_URL;
  const origin = `${base}/storage/v1/object/public/media/${path}`;
  const url = new URL(request.url);
  const w = Math.min(2400, parseInt(url.searchParams.get('w') || '0', 10) || 0);

  const cache: Cache | undefined = (globalThis as any).caches?.default;
  const cacheKey = new Request(url.toString(), { method: 'GET' });
  if (cache) { const hit = await cache.match(cacheKey); if (hit) return hit; }

  const init: RequestInit & { cf?: unknown } = {};
  if (w && (env.IMAGE_RESIZE ?? import.meta.env.IMAGE_RESIZE) === '1') {
    init.cf = { image: { width: w, fit: 'scale-down', quality: 82, format: 'auto' } };
  }
  let up: Response;
  try { up = await fetch(origin, init); } catch { return new Response('Upstream error', { status: 502 }); }
  if (!up.ok) return new Response('Not found', { status: up.status === 404 ? 404 : 502 });

  const headers = new Headers();
  headers.set('Content-Type', up.headers.get('content-type') || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Content-Type-Options', 'nosniff');
  const res = new Response(up.body, { status: 200, headers });
  if (cache) { try { await cache.put(cacheKey, res.clone()); } catch { /* best-effort */ } }
  return res;
};
