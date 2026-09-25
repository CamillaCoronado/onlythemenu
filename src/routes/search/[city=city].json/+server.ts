import { error } from '@sveltejs/kit';
import { listCity } from '$lib/server/data';
import { buildCityIndex } from '$lib/server/searchIndex';
import type { Config } from '@sveltejs/adapter-vercel';
import type { RequestHandler } from './$types';

// built once, served from the edge like a static file, rebuilt by /api/revalidate after restaurant changes
export const config: Config = { isr: { expiration: false, bypassToken: process.env.REVALIDATE_SECRET, allowQuery: [] } };

export const GET: RequestHandler = async ({ params }) => {
  const rows = await listCity(params.city);
  if (!rows.length) error(404, 'no such city');
  return new Response(buildCityIndex(rows), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' } });
};
