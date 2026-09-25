import { error } from '@sveltejs/kit';
import { getMenu, getRestaurant } from '$lib/server/data';
import { cityName } from '$lib/cities';
import type { Config } from '@sveltejs/adapter-vercel';
import type { PageServerLoad } from './$types';

export const config: Config = {
  isr: {
    // cached until /api/revalidate asks for a fresh render
    expiration: false,
    bypassToken: process.env.REVALIDATE_SECRET,
    allowQuery: []
  }
};

export const load: PageServerLoad = async ({ params }) => {
  const restaurant = await getRestaurant(params.city, params.slug);
  if (!restaurant) error(404, "we don't know that one yet");
  const menu = restaurant.hasMenu ? await getMenu(restaurant.id) : null;
  return { restaurant, menu, cityName: cityName(params.city) };
};
