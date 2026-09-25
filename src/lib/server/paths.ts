import { db } from './firebase';
import { pathsFor } from './publish';

export async function listCityPathsFor(restaurantId: string): Promise<string[]> {
  const r = (await db().collection('restaurants').doc(restaurantId).get()).data();
  return r ? pathsFor({ citySlug: r.citySlug, slug: r.slug }) : [];
}
