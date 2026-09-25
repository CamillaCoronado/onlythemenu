import { error } from '@sveltejs/kit';
import { listCity } from '$lib/server/data';
import { siteOrigin } from '$lib/server/site';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
  const rows = (await listCity(params.city)).filter((r) => r.hasMenu);
  if (!rows.length) error(404, 'no such city');
  const o = siteOrigin(url.origin);
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${o}/${params.city}</loc></url>
${rows.map((r) => `<url><loc>${o}/${r.citySlug}/${r.slug}</loc></url>`).join('\n')}
</urlset>`;
  return new Response(body, { headers: { 'content-type': 'application/xml', 'cache-control': 'public, s-maxage=86400' } });
};
