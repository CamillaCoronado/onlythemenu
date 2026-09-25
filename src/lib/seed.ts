import type { Menu, Restaurant } from './types';

/** seed json shape (section 7 of the brief) */
export type SeedFile = {
  restaurant: Omit<Restaurant, 'id' | 'hasMenu'>;
  menu: Omit<Menu, 'sourceType' | 'sourceHash' | 'verifiedAt' | 'status'>;
};

export const SEED_VERIFIED_AT = '2026-09-25T12:00:00.000Z';

export const restaurantId = (citySlug: string, slug: string) => `${citySlug}--${slug}`;

export function fromSeed(s: SeedFile, sourceHash = 'seed'): { restaurant: Restaurant; menu: Menu } {
  return {
    restaurant: { ...s.restaurant, id: restaurantId(s.restaurant.citySlug, s.restaurant.slug), hasMenu: true },
    menu: { ...s.menu, sourceType: 'owner', sourceHash, verifiedAt: SEED_VERIFIED_AT, status: 'published' }
  };
}
