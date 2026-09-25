import { error } from '@sveltejs/kit';
import { listCity } from '$lib/server/data';
import { cityName } from '$lib/cities';
import type { Config } from '@sveltejs/adapter-vercel';
import type { PageServerLoad } from './$types';

export const config: Config = {
  isr: { expiration: 86_400, bypassToken: process.env.REVALIDATE_SECRET, allowQuery: [] }
};

export const load: PageServerLoad = async ({ params }) => {
  const rows = await listCity(params.city);
  if (!rows.length) error(404, "we don't know that city yet");
  return {
    cityName: cityName(params.city),
    citySlug: params.city,
    restaurants: rows.map((r) => ({ slug: r.slug, name: r.name, hasMenu: r.hasMenu, cuisine: r.cuisine?.slice(0, 2) ?? [] }))
  };
};
