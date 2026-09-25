import { json } from '@sveltejs/kit';
import { listAllRestaurants } from '$lib/server/data';
import { buildCities } from '$lib/server/searchIndex';
import type { Config } from '@sveltejs/adapter-vercel';
import type { RequestHandler } from './$types';

export const config: Config = { isr: { expiration: false, bypassToken: process.env.REVALIDATE_SECRET, allowQuery: [] } };

export const GET: RequestHandler = async () =>
  json(buildCities(await listAllRestaurants()), { headers: { 'cache-control': 'public, max-age=300' } });
