import { db } from './firebase';
import { pathsFor } from './publish';
import { getStoredRestaurant, storeEnabled } from './store';

export async function listCityPathsFor(restaurantId: string): Promise<string[]> {
  const r = storeEnabled
    ? await getStoredRestaurant(restaurantId)
    : (await db().collection('restaurants').doc(restaurantId).get()).data();
  return r ? pathsFor({ citySlug: r.citySlug, slug: r.slug }) : [];
}
