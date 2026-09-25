import type { Menu, Restaurant } from '$lib/types';
import { fromSeed, restaurantId, type SeedFile } from '$lib/seed';
import { db, firebaseEnabled } from './firebase';
import { getStoredIndex, getStoredMenu, getStoredRestaurant, storeEnabled } from './store';

const seedFiles = import.meta.glob<SeedFile>('/seed/*.json', { eager: true, import: 'default' });
const SEED = Object.values(seedFiles).map((s) => fromSeed(s));

function toIso(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && 'toDate' in v) return (v as { toDate(): Date }).toDate().toISOString();
  return new Date(0).toISOString();
}

export async function getRestaurant(citySlug: string, slug: string): Promise<Restaurant | null> {
  if (storeEnabled) return getStoredRestaurant(restaurantId(citySlug, slug));
  if (!firebaseEnabled) return SEED.find((s) => s.restaurant.citySlug === citySlug && s.restaurant.slug === slug)?.restaurant ?? null;
  const snap = await db().collection('restaurants').doc(restaurantId(citySlug, slug)).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as Restaurant) : null;
}

/** one read. returns null for unpublished (review) menus so diners never see unvalidated data. */
export async function getMenu(id: string): Promise<Menu | null> {
  if (storeEnabled) {
    const m = await getStoredMenu(id);
    return m && m.status === 'published' ? m : null;
  }
  if (!firebaseEnabled) return SEED.find((s) => s.restaurant.id === id)?.menu ?? null;
  const snap = await db().collection('menus').doc(id).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  if (d.status !== 'published') return null;
  return { ...d, verifiedAt: toIso(d.verifiedAt) } as Menu;
}

export async function listCity(citySlug: string): Promise<Restaurant[]> {
  let rows: Restaurant[];
  if (storeEnabled) rows = (await getStoredIndex()).filter((r) => r.citySlug === citySlug);
  else if (!firebaseEnabled) rows = SEED.map((s) => s.restaurant).filter((r) => r.citySlug === citySlug);
  else {
    const snap = await db().collection('restaurants').where('citySlug', '==', citySlug).get();
    rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Restaurant);
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

export async function listAllRestaurants(): Promise<Restaurant[]> {
  if (storeEnabled) return getStoredIndex();
  if (!firebaseEnabled) return SEED.map((s) => s.restaurant);
  const snap = await db().collection('restaurants').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Restaurant);
}
