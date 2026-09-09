import { defineMiddleware } from 'astro:middleware';
import { getSessionProfile } from './lib/supabase';

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

  if (PROTECTED.some((re) => re.test(path)) && !context.locals.user) {
    return context.redirect(`/login?next=${encodeURIComponent(path)}`, 302);
  }
  if (path.startsWith('/admin') && context.locals.profile?.role !== 'admin') {
    return context.redirect('/dashboard', 302);
  }

  return next();
});
