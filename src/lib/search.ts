import MiniSearch from 'minisearch';
import { SEARCH_OPTIONS } from './searchConfig';
import { haversineKm, nearestCity } from './cities';
import type { City, SearchDoc } from './types';

export type Hit = Pick<SearchDoc, 'slug' | 'name' | 'citySlug' | 'cityName' | 'lat' | 'lng'> & { km?: number };

/** cities within this radius of the anchor city are searched together (the metro) */
const METRO_KM = 80;

let citiesP: Promise<City[]> | null = null;
const indexes = new Map<string, Promise<MiniSearch<SearchDoc> | null>>();

export function loadCities(): Promise<City[]> {
  return (citiesP ??= fetch('/search/cities.json').then((r) => (r.ok ? r.json() : [])));
}

function loadIndex(slug: string) {
  let p = indexes.get(slug);
  if (!p) {
    p = fetch(`/search/${slug}.json`)
      .then((r) => (r.ok ? r.text() : null))
      .then((t) => (t ? MiniSearch.loadJSON<SearchDoc>(t, SEARCH_OPTIONS) : null))
      .catch(() => null);
    indexes.set(slug, p);
  }
  return p;
}

export async function metroFor(anchor: City): Promise<City[]> {
  const all = await loadCities();
  return all.filter((c) => haversineKm(c, anchor) <= METRO_KM);
}

export async function warm(cities: City[]): Promise<void> {
  await Promise.all(cities.map((c) => loadIndex(c.slug)));
}

/** synchronous once warm() has resolved; that's what keeps typing < 50ms */
export async function search(q: string, cities: City[], here?: { lat: number; lng: number }, limit = 12): Promise<Hit[]> {
  const idx = (await Promise.all(cities.map((c) => loadIndex(c.slug)))).filter(Boolean) as MiniSearch<SearchDoc>[];
  const hits = idx.flatMap((m) => m.search(q)).sort((a, b) => b.score - a.score).slice(0, limit);
  return hits.map((h) => {
    const hit: Hit = { slug: h.slug, name: h.name, citySlug: h.citySlug, cityName: h.cityName, lat: h.lat, lng: h.lng };
    if (here && h.lat != null && h.lng != null) hit.km = haversineKm(here, { lat: h.lat, lng: h.lng });
    return hit;
  });
}

export { nearestCity };
