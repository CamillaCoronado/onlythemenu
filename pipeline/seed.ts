/** npm run seed: writes /seed/*.json into the blob store (or firestore) as owner menus verified 2026-09-25. */
import { Timestamp } from 'firebase-admin/firestore';
import { db, firebaseEnabled } from './firebase';
import { readSeeds } from './seedFiles';
import { sha256 } from './fetch';
import { validate } from './validate';
import { buildSearchIndex } from './build-search-index';
import { SEED_VERIFIED_AT } from '../src/lib/seed';
import { putRestaurant, storeEnabled } from '../src/lib/server/store';

async function main() {
  const seeds = readSeeds();
  for (const s of seeds) {
    const v = validate(s.menu);
    if (!v.ok) throw new Error(`${s.file} fails validation: ${v.failures.join('; ')}`);
  }
  if (storeEnabled) {
    for (const s of seeds) {
      await putRestaurant(s.restaurant, { ...s.menu, sourceHash: sha256(s.raw) });
      console.log(`seeded ${s.restaurant.id}`);
    }
    return;
  }
  if (!firebaseEnabled) {
    console.log(`${seeds.length} seed menus valid. No store configured, so nothing written (the app reads /seed directly).`);
    return;
  }
  const batch = db().batch();
  for (const s of seeds) {
    const { id, ...restaurant } = s.restaurant;
    batch.set(db().collection('restaurants').doc(id), restaurant, { merge: true });
    batch.set(db().collection('menus').doc(id), {
      ...s.menu, sourceType: 'owner', sourceHash: sha256(s.raw), status: 'published',
      verifiedAt: Timestamp.fromDate(new Date(SEED_VERIFIED_AT))
    });
    batch.set(db().collection('sources').doc(id), { url: s.menu.sourceUrl, adapter: 'owner', pinned: true, failCount: 0 }, { merge: true });
    console.log(`seeded ${id}`);
  }
  await batch.commit();
  await buildSearchIndex();
}

main().catch((e) => { console.error(e); process.exit(1); });
