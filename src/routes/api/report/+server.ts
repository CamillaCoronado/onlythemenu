import { error, json } from '@sveltejs/kit';
import { FieldValue } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { db, firebaseEnabled } from '$lib/server/firebase';
import { getReports, getStoredMenu, putReports, storeEnabled } from '$lib/server/store';
import { allow } from '$lib/server/ratelimit';
import { maybeAutoApply } from '$lib/server/reports';
import { listCityPathsFor } from '$lib/server/paths';
import { revalidatePaths } from '$lib/server/publish';
import type { RequestHandler } from './$types';

type Body = {
  restaurantId: string; sectionIdx: number; itemIdx: number; itemName: string;
  variantLabel?: string; reportedCents: number;
};

function valid(b: Partial<Body>): b is Body {
  return typeof b.restaurantId === 'string' && /^[a-z0-9-]{3,120}$/.test(b.restaurantId)
    && Number.isInteger(b.sectionIdx) && b.sectionIdx! >= 0 && b.sectionIdx! < 200
    && Number.isInteger(b.itemIdx) && b.itemIdx! >= 0 && b.itemIdx! < 500
    && typeof b.itemName === 'string' && b.itemName.length > 0 && b.itemName.length <= 200
    && (b.variantLabel === undefined || (typeof b.variantLabel === 'string' && b.variantLabel.length <= 60))
    && Number.isInteger(b.reportedCents) && b.reportedCents! >= 50 && b.reportedCents! <= 50_000;
}

export const POST: RequestHandler = async ({ request, getClientAddress, url }) => {
  if (!(await allow(getClientAddress(), 'report', 20, 3_600_000))) error(429, 'slow down');
  const b = (await request.json().catch(() => ({}))) as Partial<Body>;
  if (!valid(b)) error(400, 'bad report');

  if (storeEnabled) {
    const menu = await getStoredMenu(b.restaurantId);
    const item = menu?.sections?.[b.sectionIdx]?.items?.[b.itemIdx];
    if (!item || item.name !== b.itemName) error(409, 'menu changed, reload');

    const rows = await getReports(b.restaurantId);
    rows.push({
      id: randomUUID(), restaurantId: b.restaurantId, sectionIdx: b.sectionIdx, itemIdx: b.itemIdx,
      itemName: b.itemName, ...(b.variantLabel && { variantLabel: b.variantLabel }),
      reportedCents: b.reportedCents, createdAt: new Date().toISOString(), status: 'open'
    });
    await putReports(b.restaurantId, rows);

    const applied = await maybeAutoApply(b, b.reportedCents);
    if (applied) await revalidatePaths(url.origin, await listCityPathsFor(b.restaurantId));
    return json({ ok: true, stored: true, applied });
  }

  if (!firebaseEnabled) {
    console.info('[report:dev]', b);
    return json({ ok: true, stored: false });
  }
  // item must exist and name must match, so stale indexes can't hit the wrong item
  const menu = await db().collection('menus').doc(b.restaurantId).get();
  const item = menu.data()?.sections?.[b.sectionIdx]?.items?.[b.itemIdx];
  if (!item || item.name !== b.itemName) error(409, 'menu changed, reload');

  await db().collection('reports').add({
    restaurantId: b.restaurantId, sectionIdx: b.sectionIdx, itemIdx: b.itemIdx, itemName: b.itemName,
    ...(b.variantLabel && { variantLabel: b.variantLabel }),
    reportedCents: b.reportedCents, createdAt: FieldValue.serverTimestamp(), status: 'open'
  });
  const applied = await maybeAutoApply(b, b.reportedCents);
  if (applied) await revalidatePaths(url.origin, await listCityPathsFor(b.restaurantId));
  return json({ ok: true, stored: true, applied });
};
