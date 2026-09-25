import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from './$types';

function same(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * POST /api/revalidate?path=/perry-ut/maddox-ranch-house  (header: authorization: Bearer <REVALIDATE_SECRET>)
 * vercel ISR regenerates a path when it's requested with x-prerender-revalidate = bypassToken.
 */
export const POST: RequestHandler = async ({ url, request, fetch }) => {
  const secret = env.REVALIDATE_SECRET;
  const given = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? url.searchParams.get('secret') ?? '';
  if (!secret || !same(given, secret)) error(401, 'nope');

  const paths = url.searchParams.getAll('path').filter((p) => /^\/[a-z0-9/.-]*$/.test(p) && !p.includes('..'));
  if (!paths.length) error(400, 'path required');

  const results = await Promise.all(paths.map(async (p) => {
    const res = await fetch(new URL(p, url.origin), { method: 'HEAD', headers: { 'x-prerender-revalidate': secret } });
    return { path: p, status: res.status };
  }));
  return json({ revalidated: results });
};
