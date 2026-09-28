import { defineMiddleware } from 'astro:middleware';
import { getSessionProfile } from './lib/supabase';
import { isStaff, can, canWrite, sectionFor } from './lib/roles';

const PROTECTED = [/^\/dashboard/, /^\/admin/, /^\/careers\/[^/]+\/apply\/?$/];

export const onRequest = defineMiddleware(async (context, next) => {
  // Prerendered marketing pages have no real request — don't touch cookies/headers there.
  if (context.isPrerendered) return next();

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

  return next();
});
