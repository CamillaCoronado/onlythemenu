import { error, redirect } from '@sveltejs/kit';
import { firebaseEnabled } from './firebase';

export function requireUser(locals: App.Locals, url: URL): string {
  if (!firebaseEnabled) error(503, 'accounts need firebase configured');
  if (!locals.uid) redirect(303, `/login?next=${encodeURIComponent(url.pathname)}`);
  return locals.uid;
}

export function requireAdmin(locals: App.Locals, url: URL): string {
  const uid = requireUser(locals, url);
  if (!locals.isAdmin) error(403, 'admins only');
  return uid;
}
