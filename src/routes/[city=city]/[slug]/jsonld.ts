import type { Menu, Restaurant } from '$lib/types';

const usd = (c: number) => (c / 100).toFixed(2);

/** schema.org Restaurant + Menu. prices are strings per schema.org Offer.price guidance. */
export function menuJsonLd(r: Restaurant, m: Menu, url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: r.name,
    url,
    address: r.address,
    ...(r.phone && { telephone: r.phone }),
    ...(r.cuisine?.length && { servesCuisine: r.cuisine }),
    ...(r.geo && { geo: { '@type': 'GeoCoordinates', latitude: r.geo.lat, longitude: r.geo.lng } }),
    hasMenu: {
      '@type': 'Menu',
      ...(m.houseNotes && { description: m.houseNotes }),
      hasMenuSection: m.sections.map((s) => ({
        '@type': 'MenuSection',
        name: s.title,
        ...(s.note && { description: s.note }),
        hasMenuItem: s.items.map((it) => {
          const offers = it.variants?.length
            ? it.variants.map((v) => ({ '@type': 'Offer', name: v.label, price: usd(v.priceCents), priceCurrency: 'USD' }))
            : it.priceCents !== undefined
              ? { '@type': 'Offer', price: usd(it.priceCents), priceCurrency: 'USD' }
              : undefined;
          return {
            '@type': 'MenuItem',
            name: it.name,
            ...(it.description && { description: it.description }),
            ...(offers && { offers }),
            ...(it.tags?.includes('VG') && { suitableForDiet: 'https://schema.org/VeganDiet' }),
            ...(it.tags?.includes('V') && { suitableForDiet: 'https://schema.org/VegetarianDiet' }),
            ...(it.tags?.includes('GF') && { suitableForDiet: 'https://schema.org/GlutenFreeDiet' })
          };
        })
      }))
    }
  };
}

/** safe to drop inside <script type="application/ld+json"> */
export const ldString = (o: unknown) => JSON.stringify(o).replace(/</g, '\\u003c');
