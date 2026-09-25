/**
 * the loop in brief §6: fetch -> hash -> detect -> parse -> normalize -> validate -> publish | review.
 *   npx tsx pipeline/run.ts                 # every source due this week
 *   npx tsx pipeline/run.ts <restaurantId>  # one source now
 */
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Menu, Restaurant, SourceType } from '../src/lib/types';
import { db, bucket } from './firebase';
import {
  getStoredMenu, getStoredRestaurant, getSource, listSources, patchSource,
  putRaw, putRestaurant, storeEnabled, type Source as StoredSource
} from '../src/lib/server/store';
import { politeFetch, extFor, RobotsDenied } from './fetch';
import { detect } from './detect';
import { ADAPTERS } from './adapters';
import { normalizeMenu } from './normalize';
import { validate } from './validate';
import { publish, sendToReview } from './publish';
import { buildSearchIndex } from './build-search-index';

type Source = { url: string; adapter?: SourceType; pinned?: boolean; lastFetchedAt?: Timestamp | string; lastHash?: string | null; failCount?: number };
const WEEK = 7 * 86_400_000;

const millis = (v: Source['lastFetchedAt']): number =>
  !v ? 0 : typeof v === 'string' ? Date.parse(v) : v.toMillis();

export async function runOne(id: string, src: Source): Promise<'skip' | 'published' | 'review' | 'error'> {
  try {
    const doc = await politeFetch(src.url);
    if (doc.hash === src.lastHash) {
      if (storeEnabled) {
        await patchSource(id, { lastFetchedAt: new Date().toISOString() });
        const m = await getStoredMenu(id);
        const r = await getStoredRestaurant(id);
        if (m && r) await putRestaurant(r, { ...m, verifiedAt: new Date().toISOString() });
      } else {
        await db().collection('sources').doc(id).update({ lastFetchedAt: FieldValue.serverTimestamp() });
        await db().collection('menus').doc(id).update({ verifiedAt: FieldValue.serverTimestamp() }).catch(() => {});
      }
      return 'skip';
    }
    const iso = new Date().toISOString();
    const rawPath = `raw/${id}/${iso}.${extFor(doc.contentType)}`;
    if (storeEnabled) await putRaw(rawPath, doc.body, doc.contentType);
    else await bucket().file(rawPath).save(doc.body, { contentType: doc.contentType, resumable: false });

    // owner/user are provenance, not parsers: re-detect when someone forces a run on those
    const type = src.pinned && src.adapter && ADAPTERS[src.adapter] ? src.adapter : detect(doc);
    const adapter = ADAPTERS[type];
    if (!adapter) throw new Error(`no adapter for ${type}`);
    const parsed = await adapter.parse(doc);

    let r: Restaurant;
    let prev: Menu | null;
    if (storeEnabled) {
      const stored = await getStoredRestaurant(id);
      if (!stored) throw new Error(`no restaurant ${id}`);
      r = stored;
      prev = await getStoredMenu(id);
    } else {
      const rsnap = await db().collection('restaurants').doc(id).get();
      r = { id, ...rsnap.data() } as Restaurant;
      const prevSnap = await db().collection('menus').doc(id).get();
      prev = prevSnap.exists ? (prevSnap.data() as Menu) : null;
    }

    const draft = normalizeMenu({
      ...parsed, houseNotes: parsed.houseNotes ?? prev?.houseNotes,
      sourceUrl: src.url, sourceHash: doc.hash, verifiedAt: '', status: 'review'
    } as Menu);
    const { verifiedAt: _v, status: _s, ...d } = draft;
    const verdict = validate(draft, prev?.status === 'published' ? prev : null);

    if (storeEnabled) await patchSource(id, { url: src.url, lastFetchedAt: new Date().toISOString(), lastHash: doc.hash, adapter: type, failCount: 0 });
    else await db().collection('sources').doc(id).set({ lastFetchedAt: FieldValue.serverTimestamp(), lastHash: doc.hash, adapter: type, failCount: 0 }, { merge: true });

    if (verdict.ok) { await publish(r, d, { reindex: false }); return 'published'; }
    await sendToReview(r, d, verdict.failures, rawPath);
    return 'review';
  } catch (e) {
    console.error(`[${id}]`, e instanceof RobotsDenied ? e.message : e);
    if (storeEnabled) {
      const cur = await getSource(id);
      await patchSource(id, { url: src.url, failCount: (cur?.failCount ?? 0) + 1, lastFetchedAt: new Date().toISOString() });
    } else {
      await db().collection('sources').doc(id).set({ failCount: FieldValue.increment(1), lastFetchedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    return 'error';
  }
}

async function main() {
  const only = process.argv[2];
  let sources: { id: string; src: Source }[];
  if (storeEnabled) {
    const rows: (StoredSource & { id?: string })[] = only
      ? [await getSource(only).then((s) => (s ? { ...s, id: only } : null))].filter((s): s is StoredSource & { id: string } => !!s)
      : await listSources();
    sources = rows.filter((s) => s.id).map((s) => ({ id: s.id!, src: s as Source }));
  } else {
    const snap = only ? [await db().collection('sources').doc(only).get()] : (await db().collection('sources').get()).docs;
    sources = snap.filter((s) => s.exists).map((s) => ({ id: s.id, src: s.data() as Source }));
  }

  const cutoff = Date.now() - WEEK;
  const tally: Record<string, number> = {};
  const cities = new Set<string>();
  for (const { id, src } of sources) {
    if (!only && millis(src.lastFetchedAt) > cutoff) continue;
    // owner-edited and user-submitted menus aren't scraped on schedule (only when run explicitly)
    if (!only && src.pinned && (src.adapter === 'owner' || src.adapter === 'user')) continue;
    const out = await runOne(id, src);
    tally[out] = (tally[out] ?? 0) + 1;
    if (out === 'published') cities.add(id.split('--')[0]);
    console.log(`${out.padEnd(9)} ${id}`);
  }
  if (cities.size) await buildSearchIndex([...cities]);
  console.log(tally);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
