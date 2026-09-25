import { fail, redirect } from '@sveltejs/kit';
import { adminAuthEnabled, checkPassword, issueToken } from '$lib/server/adminAuth';
import { ADMIN_COOKIE } from '$lib/server/session';
import { allow } from '$lib/server/ratelimit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ passwordLogin: adminAuthEnabled() });

export const actions: Actions = {
  password: async ({ request, cookies, url, getClientAddress }) => {
    if (!(await allow(getClientAddress(), 'login', 10, 900_000))) return fail(429, { err: 'too many tries, wait a bit' });
    const given = String((await request.formData()).get('password') ?? '');
    if (!checkPassword(given)) return fail(401, { err: 'wrong password' });

    const { value, maxAge } = issueToken();
    cookies.set(ADMIN_COOKIE, value, { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge });
    const next = url.searchParams.get('next');
    redirect(303, next?.startsWith('/') ? next : '/admin/review');
  }
};
