import { error } from '@sveltejs/kit';
import { getMenu, getRestaurant } from '$lib/server/data';
import { ogPng } from '$lib/server/og';
import type { Config } from '@sveltejs/adapter-vercel';
import type { RequestHandler } from './$types';

export const config: Config = { isr: { expiration: false, bypassToken: process.env.REVALIDATE_SECRET, allowQuery: [] } };

export const GET: RequestHandler = async ({ params }) => {
  const r = await getRestaurant(params.city, params.slug);
  const m = r?.hasMenu ? await getMenu(r.id) : null;
  if (!r || !m) error(404, 'no menu');
  return new Response(await ogPng(r, m) as BodyInit, {
    headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400, s-maxage=604800' }
  });
};
