import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { auth, firebaseEnabled } from '$lib/server/firebase';

import { SESSION_COOKIE } from '$lib/server/session';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.uid = null;
  event.locals.isAdmin = false;
  const p = event.url.pathname;
  // only the auth'd surfaces look at the cookie; menu/city/search pages stay cache-friendly
  if (firebaseEnabled && /^\/(owner|claim|admin|api\/(owner|admin|claim))/.test(p)) {
    const c = event.cookies.get(SESSION_COOKIE);
    if (c) {
      try {
        const t = await auth().verifySessionCookie(c, true);
        event.locals.uid = t.uid;
        event.locals.isAdmin = (env.ADMIN_UIDS ?? '').split(',').map((s) => s.trim()).includes(t.uid);
      } catch { event.cookies.delete(SESSION_COOKIE, { path: '/' }); }
    }
  }
  const res = await resolve(event);
  res.headers.set('x-content-type-options', 'nosniff');
  res.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  return res;
};
