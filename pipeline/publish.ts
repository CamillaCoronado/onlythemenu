/** write menus/{id} + history snapshot, revalidate the page, rebuild the city index. or park it in review. */
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Menu, Restaurant } from '../src/lib/types';
import { db } from './firebase';
import { buildSearchIndex } from './build-search-index';
import { revalidate } from './revalidate';

export type Draft = Omit<Menu, 'verifiedAt' | 'status'>;

export async function publish(r: Restaurant, draft: Draft, opts: { reindex?: boolean } = {}) {
  const ref = db().collection('menus').doc(r.id);
  const now = Timestamp.now();
  await db().runTransaction(async (tx) => {
    const prev = await tx.get(ref);
    if (prev.exists) tx.set(ref.collection('history').doc(now.toDate().toISOString()), prev.data()!);
    tx.set(ref, { ...draft, verifiedAt: now, status: 'published' });
    tx.set(db().collection('restaurants').doc(r.id), { hasMenu: true }, { merge: true });
    tx.delete(db().collection('review').doc(r.id));
  });
  await revalidate([`/${r.citySlug}/${r.slug}`, `/${r.citySlug}`, `/og/${r.citySlug}/${r.slug}.png`]);
  if (opts.reindex !== false) await buildSearchIndex([r.citySlug]);
}

/** review/{restaurantId}: the draft + why it failed. /admin/review reads this. */
export async function sendToReview(r: Restaurant, draft: Draft, failures: string[], rawPath?: string) {
  await db().collection('review').doc(r.id).set({
    restaurantId: r.id, citySlug: r.citySlug, slug: r.slug, name: r.name,
    draft, failures, ...(rawPath && { rawPath }), createdAt: FieldValue.serverTimestamp()
  });
}
