import { listAllRestaurants } from '$lib/server/data';
import { siteOrigin } from '$lib/server/site';
import type { RequestHandler } from './$types';

/** sitemap index -> one sitemap per city */
export const GET: RequestHandler = async ({ url }) => {
  const cities = [...new Set((await listAllRestaurants()).filter((r) => r.hasMenu).map((r) => r.citySlug))].sort();
  const o = siteOrigin(url.origin);
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${cities.map((c) => `<sitemap><loc>${o}/sitemap-${c}.xml</loc></sitemap>`).join('\n')}
</sitemapindex>`;
  return new Response(body, { headers: { 'content-type': 'application/xml', 'cache-control': 'public, s-maxage=86400' } });
};
