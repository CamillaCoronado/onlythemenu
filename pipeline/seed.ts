/** npm run seed: writes /seed/*.json into firestore as owner menus verified 2026-09-25, then rebuilds search. */
import { Timestamp } from 'firebase-admin/firestore';
import { db, firebaseEnabled } from './firebase';
import { readSeeds } from './seedFiles';
import { sha256 } from './fetch';
import { validate } from './validate';
import { buildSearchIndex } from './build-search-index';
import { SEED_VERIFIED_AT } from '../src/lib/seed';

async function main() {
  const seeds = readSeeds();
  for (const s of seeds) {
    const v = validate(s.menu);
    if (!v.ok) throw new Error(`${s.file} fails validation: ${v.failures.join('; ')}`);
  }
  if (!firebaseEnabled) {
    console.log(`${seeds.length} seed menus valid. FIREBASE_* unset, so nothing written (the app reads /seed directly).`);
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
