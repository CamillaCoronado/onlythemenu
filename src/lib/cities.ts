import type { City } from './types';

/** launch metro: box elder + cache counties, ut. centroids are approximate city centers. */
export const CITIES: City[] = [
  { slug: 'perry-ut', name: 'Perry, UT', lat: 41.465, lng: -112.033 },
  { slug: 'brigham-city-ut', name: 'Brigham City, UT', lat: 41.5102, lng: -112.0155 },
  { slug: 'tremonton-ut', name: 'Tremonton, UT', lat: 41.7119, lng: -112.1655 },
  { slug: 'logan-ut', name: 'Logan, UT', lat: 41.737, lng: -111.8338 },
  { slug: 'north-logan-ut', name: 'North Logan, UT', lat: 41.7694, lng: -111.8047 },
  { slug: 'smithfield-ut', name: 'Smithfield, UT', lat: 41.8383, lng: -111.8327 },
  { slug: 'hyrum-ut', name: 'Hyrum, UT', lat: 41.6341, lng: -111.8513 }
];

export function cityName(slug: string): string {
  const c = CITIES.find((c) => c.slug === slug);
  if (c) return c.name;
  // 'salt-lake-city-ut' -> 'Salt Lake City, UT'
  const parts = slug.split('-');
  const st = parts.pop()?.toUpperCase() ?? '';
  return `${parts.map((p) => p[0].toUpperCase() + p.slice(1)).join(' ')}, ${st}`;
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function nearestCity(p: { lat: number; lng: number }, cities: City[] = CITIES): City {
  return cities.reduce((best, c) => (haversineKm(p, c) < haversineKm(p, best) ? c : best));
}
