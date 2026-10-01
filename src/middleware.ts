import { defineMiddleware } from 'astro:middleware';
import { getSessionProfile } from './lib/supabase';
import { isStaff, can, canWrite, sectionFor } from './lib/roles';

const PROTECTED = [/^\/dashboard/, /^\/admin/, /^\/careers\/[^/]+\/apply\/?$/];

export const onRequest = defineMiddleware(async (context, next) => {
  // Prerendered marketing pages have no real request — don't touch cookies/headers there.
  if (context.isPrerendered) return next();

  // www → apex, http → https: one canonical host (301) so search engines see a single site.
  const host = context.request.headers.get('host') || '';
  if (host.startsWith('www.vacanthr.com')) {
    return Response.redirect(`https://vacanthr.com${context.url.pathname}${context.url.search}`, 301);
  }

  try {
    const { user, profile } = await getSessionProfile(context);
    context.locals.user = user;
    context.locals.profile = profile;
  } catch {
    context.locals.user = null;
    context.locals.profile = null;
  }

  const path = context.url.pathname;
  const role = context.locals.profile?.role;

  if (PROTECTED.some((re) => re.test(path)) && !context.locals.user) {
    return context.redirect(`/login?next=${encodeURIComponent(path)}`, 302);
  }
  if (path.startsWith('/admin')) {
    // Section-level access per staff role (see lib/roles.ts); viewer is read-only.
    if (!isStaff(role)) return context.redirect('/dashboard', 302);
    const section = sectionFor(path);
    if (section !== 'home' && !can(role, section)) return context.redirect('/admin?denied=1', 302);
    if (context.request.method !== 'GET' && context.request.method !== 'HEAD' && !canWrite(role)) {
      return context.redirect(`${path}?denied=1`, 303);
    }
  }

  return withCharset(await next());
});

/** Astro emits `text/html` without a charset on SSR responses; crawlers prefer it in the header too. */
function withCharset(res: Response): Response {
  const ct = res.headers.get('content-type');
  if (!ct || ct !== 'text/html') return res;
  try { res.headers.set('content-type', 'text/html; charset=utf-8'); return res; }
  catch { const r = new Response(res.body, res); r.headers.set('content-type', 'text/html; charset=utf-8'); return r; }
}
