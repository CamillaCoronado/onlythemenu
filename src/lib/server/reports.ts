import { Timestamp } from 'firebase-admin/firestore';
import type { Menu } from '$lib/types';
import { db } from './firebase';

const WINDOW_MS = 14 * 86_400_000;
const MAX_JUMP = 0.25; // same rule as pipeline/validate.ts: bigger jumps need a human

export type ReportKey = { restaurantId: string; sectionIdx: number; itemIdx: number; itemName: string; variantLabel?: string };

/** set the reported price on one item (or one variant). returns the old cents, or null if the item moved. */
export async function applyPrice(k: ReportKey, cents: number): Promise<number | null> {
  const ref = db().collection('menus').doc(k.restaurantId);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const m = snap.data() as Menu | undefined;
    const it = m?.sections[k.sectionIdx]?.items[k.itemIdx];
    if (!m || !it || it.name !== k.itemName) return null;
    let old: number | undefined;
    if (k.variantLabel && it.variants) {
      const v = it.variants.find((v) => v.label === k.variantLabel);
      if (!v) return null;
      old = v.priceCents; v.priceCents = cents;
    } else {
      old = it.priceCents; it.priceCents = cents; delete it.marketPrice;
    }
    tx.set(ref.collection('history').doc(new Date().toISOString()), snap.data()!);
    tx.update(ref, { sections: m.sections });
    return old ?? 0;
  });
}

/** two matching reports within 14 days auto-apply (brief §6), unless the jump is >25% */
export async function maybeAutoApply(k: ReportKey, cents: number): Promise<boolean> {
  const since = Timestamp.fromMillis(Date.now() - WINDOW_MS);
  const q = await db().collection('reports')
    .where('restaurantId', '==', k.restaurantId).where('sectionIdx', '==', k.sectionIdx).where('itemIdx', '==', k.itemIdx)
    .where('reportedCents', '==', cents).where('status', '==', 'open').where('createdAt', '>=', since).get();
  const same = q.docs.filter((d) => (d.data().variantLabel ?? null) === (k.variantLabel ?? null) && d.data().itemName === k.itemName);
  if (same.length < 2) return false;

  const menu = (await db().collection('menus').doc(k.restaurantId).get()).data() as Menu | undefined;
  const it = menu?.sections[k.sectionIdx]?.items[k.itemIdx];
  const cur = k.variantLabel ? it?.variants?.find((v) => v.label === k.variantLabel)?.priceCents : it?.priceCents;
  if (cur !== undefined && cur > 0 && Math.abs(cents - cur) / cur > MAX_JUMP) return false;

  const old = await applyPrice(k, cents);
  if (old === null) return false;
  const batch = db().batch();
  for (const d of same) batch.update(d.ref, { status: 'applied' });
  await batch.commit();
  return true;
}
