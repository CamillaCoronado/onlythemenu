import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { env } from '$env/dynamic/private';
import type { Menu, Restaurant, Section, SourceType } from '$lib/types';
import { db } from './firebase';
import { createHash } from 'node:crypto';

/** ask vercel ISR to regenerate these paths (same mechanism as /api/revalidate) */
export async function revalidatePaths(origin: string, paths: string[]) {
  const secret = env.REVALIDATE_SECRET;
  if (!secret) return;
  await Promise.all(paths.map((p) =>
    fetch(new URL(p, origin), { method: 'HEAD', headers: { 'x-prerender-revalidate': secret } }).catch(() => null)));
}

export const pathsFor = (r: Pick<Restaurant, 'citySlug' | 'slug'>) =>
  [`/${r.citySlug}/${r.slug}`, `/${r.citySlug}`, `/og/${r.citySlug}/${r.slug}.png`, `/search/${r.citySlug}.json`];

/** write menus/{id} (snapshotting the previous one into history) and mark the restaurant as having a menu */
export async function writeMenu(
  r: Restaurant,
  m: { houseNotes?: string; sections: Section[]; sourceUrl: string; sourceType: SourceType; sourceHash?: string }
) {
  const ref = db().collection('menus').doc(r.id);
  const now = Timestamp.now();
  const hash = m.sourceHash ?? createHash('sha256').update(JSON.stringify(m.sections)).digest('hex');
  await db().runTransaction(async (tx) => {
    const prev = await tx.get(ref);
    if (prev.exists) tx.set(ref.collection('history').doc(now.toDate().toISOString()), prev.data()!);
    const doc: Omit<Menu, 'verifiedAt'> & { verifiedAt: Timestamp } = {
      ...(m.houseNotes && { houseNotes: m.houseNotes }), sections: m.sections,
      sourceUrl: m.sourceUrl, sourceType: m.sourceType, sourceHash: hash, verifiedAt: now, status: 'published'
    };
    tx.set(ref, doc);
    tx.set(db().collection('restaurants').doc(r.id), { hasMenu: true }, { merge: true });
    tx.delete(db().collection('review').doc(r.id));
  });
}

export { FieldValue };
