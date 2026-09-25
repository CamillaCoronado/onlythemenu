import { Timestamp } from 'firebase-admin/firestore';
import type { Menu } from '$lib/types';
import { db } from './firebase';
import { getReports, getStoredMenu, patchMenu, putReports, storeEnabled } from './store';

const WINDOW_MS = 14 * 86_400_000;
const MAX_JUMP = 0.25; // same rule as pipeline/validate.ts: bigger jumps need a human

export type ReportKey = { restaurantId: string; sectionIdx: number; itemIdx: number; itemName: string; variantLabel?: string };

/** the reported price written onto the item in place. returns the old cents, or null if the item moved. */
function setPrice(m: Menu, k: ReportKey, cents: number): number | null {
  const it = m.sections[k.sectionIdx]?.items[k.itemIdx];
  if (!it || it.name !== k.itemName) return null;
  if (k.variantLabel && it.variants) {
    const v = it.variants.find((x) => x.label === k.variantLabel);
    if (!v) return null;
    const old = v.priceCents;
    v.priceCents = cents;
    return old ?? 0;
  }
  const old = it.priceCents;
  it.priceCents = cents;
  delete it.marketPrice;
  return old ?? 0;
}

/** set the reported price on one item (or one variant). returns the old cents, or null if the item moved. */
export async function applyPrice(k: ReportKey, cents: number): Promise<number | null> {
  if (storeEnabled) {
    const m = await getStoredMenu(k.restaurantId);
    if (!m) return null;
    const old = setPrice(m, k, cents);
    if (old === null) return null;
    await patchMenu(k.restaurantId, m.sections);
    return old;
  }
  const ref = db().collection('menus').doc(k.restaurantId);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const m = snap.data() as Menu | undefined;
    if (!m) return null;
    const old = setPrice(m, k, cents);
    if (old === null) return null;
    tx.set(ref.collection('history').doc(new Date().toISOString()), snap.data()!);
    tx.update(ref, { sections: m.sections });
    return old;
  });
}

const sameKey = (r: { itemName: string; variantLabel?: string }, k: ReportKey) =>
  (r.variantLabel ?? null) === (k.variantLabel ?? null) && r.itemName === k.itemName;

/** two matching reports within 14 days auto-apply (brief §6), unless the jump is >25% */
export async function maybeAutoApply(k: ReportKey, cents: number): Promise<boolean> {
  const since = Date.now() - WINDOW_MS;

  if (storeEnabled) {
    const rows = await getReports(k.restaurantId);
    const same = rows.filter((r) =>
      r.status === 'open' && r.sectionIdx === k.sectionIdx && r.itemIdx === k.itemIdx &&
      r.reportedCents === cents && Date.parse(r.createdAt) >= since && sameKey(r, k));
    if (same.length < 2) return false;

    const menu = await getStoredMenu(k.restaurantId);
    const it = menu?.sections[k.sectionIdx]?.items[k.itemIdx];
    const cur = k.variantLabel ? it?.variants?.find((v) => v.label === k.variantLabel)?.priceCents : it?.priceCents;
    if (cur !== undefined && cur > 0 && Math.abs(cents - cur) / cur > MAX_JUMP) return false;

    if ((await applyPrice(k, cents)) === null) return false;
    const applied = new Set(same.map((r) => r.id));
    await putReports(k.restaurantId, rows.map((r) => (applied.has(r.id) ? { ...r, status: 'applied' as const } : r)));
    return true;
  }

  const q = await db().collection('reports')
    .where('restaurantId', '==', k.restaurantId).where('sectionIdx', '==', k.sectionIdx).where('itemIdx', '==', k.itemIdx)
    .where('reportedCents', '==', cents).where('status', '==', 'open').where('createdAt', '>=', Timestamp.fromMillis(since)).get();
  const same = q.docs.filter((d) => sameKey(d.data() as { itemName: string; variantLabel?: string }, k));
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
