import { error, json } from '@sveltejs/kit';
import { auth, firebaseEnabled } from '$lib/server/firebase';
import { SESSION_COOKIE } from '$lib/server/session';
import type { RequestHandler } from './$types';

const DAYS = 5;

/** exchange a fresh firebase id token for an httpOnly session cookie */
export const POST: RequestHandler = async ({ request, cookies }) => {
  if (!firebaseEnabled) error(503, 'auth not configured');
  const { idToken } = await request.json().catch(() => ({}));
  if (typeof idToken !== 'string') error(400, 'idToken required');
  const decoded = await auth().verifyIdToken(idToken).catch(() => null);
  if (!decoded || Date.now() / 1000 - decoded.auth_time > 300) error(401, 'sign in again');
  const expiresIn = DAYS * 86_400_000;
  const session = await auth().createSessionCookie(idToken, { expiresIn });
  cookies.set(SESSION_COOKIE, session, { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: expiresIn / 1000 });
  return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ cookies }) => {
  cookies.delete(SESSION_COOKIE, { path: '/' });
  return json({ ok: true });
};
