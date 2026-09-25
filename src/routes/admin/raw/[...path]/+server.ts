import { error } from '@sveltejs/kit';
import { get } from '@vercel/blob';
import { requireAdmin } from '$lib/server/guard';
import type { RequestHandler } from './$types';

/** the page a review entry was parsed from. private blobs have no public url, so stream it behind the admin gate. */
export const GET: RequestHandler = async ({ locals, url, params }) => {
  requireAdmin(locals, url);
  if (!params.path.startsWith('raw/')) error(404, 'not found');

  const res = await get(params.path, { access: 'private' }).catch(() => null);
  if (!res || res.statusCode !== 200) error(404, 'not found');

  return new Response(res.stream, {
    headers: {
      'content-type': res.blob?.contentType ?? 'application/octet-stream',
      'cache-control': 'private, no-store'
    }
  });
};
