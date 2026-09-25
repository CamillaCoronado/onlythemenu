// pure: shared by the /search routes and pipeline scripts. no $env / $app imports here.
import MiniSearch from 'minisearch';
import { SEARCH_OPTIONS } from '../searchConfig';
import { CITIES, cityName } from '../cities';
import type { City, Restaurant, SearchDoc } from '../types';

export function buildCityIndex(rows: Restaurant[]): string {
  const ms = new MiniSearch<SearchDoc>(SEARCH_OPTIONS);
  ms.addAll(rows.map((r) => ({
    id: r.id, slug: r.slug, name: r.name, citySlug: r.citySlug, cityName: cityName(r.citySlug),
    cuisine: (r.cuisine ?? []).join(' '), lat: r.geo?.lat ?? null, lng: r.geo?.lng ?? null
  })));
  return JSON.stringify(ms);
}

/** known centroids, else the mean of that city's geocoded restaurants */
export function buildCities(rows: Restaurant[]): City[] {
  const by = new Map<string, Restaurant[]>();
  for (const r of rows) by.set(r.citySlug, [...(by.get(r.citySlug) ?? []), r]);
  return [...by.keys()].sort().flatMap((slug) => {
    const known = CITIES.find((c) => c.slug === slug);
    if (known) return [known];
    const g = by.get(slug)!.filter((r) => r.geo).map((r) => r.geo!);
    if (!g.length) return [];
    return [{ slug, name: cityName(slug), lat: g.reduce((a, b) => a + b.lat, 0) / g.length, lng: g.reduce((a, b) => a + b.lng, 0) / g.length }];
  });
}
