/**
 * the loop in brief §6: fetch -> hash -> detect -> parse -> normalize -> validate -> publish | review.
 *   npx tsx pipeline/run.ts                 # every source due this week
 *   npx tsx pipeline/run.ts <restaurantId>  # one source now
 */
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Menu, Restaurant, SourceType } from '../src/lib/types';
import { db, bucket } from './firebase';
import { politeFetch, extFor, RobotsDenied } from './fetch';
import { detect } from './detect';
import { ADAPTERS } from './adapters';
import { normalizeMenu } from './normalize';
import { validate } from './validate';
import { publish, sendToReview } from './publish';
import { buildSearchIndex } from './build-search-index';

type Source = { url: string; adapter?: SourceType; pinned?: boolean; lastFetchedAt?: Timestamp; lastHash?: string; failCount?: number };
const WEEK = 7 * 86_400_000;

export async function runOne(id: string, src: Source): Promise<'skip' | 'published' | 'review' | 'error'> {
  const sref = db().collection('sources').doc(id);
  try {
    const doc = await politeFetch(src.url);
    if (doc.hash === src.lastHash) {
      await sref.update({ lastFetchedAt: FieldValue.serverTimestamp() });
      await db().collection('menus').doc(id).update({ verifiedAt: FieldValue.serverTimestamp() }).catch(() => {});
      return 'skip';
    }
    const iso = new Date().toISOString();
    const rawPath = `raw/${id}/${iso}.${extFor(doc.contentType)}`;
    await bucket().file(rawPath).save(doc.body, { contentType: doc.contentType, resumable: false });

    // owner/user are provenance, not parsers: re-detect when someone forces a run on those
    const type = src.pinned && src.adapter && ADAPTERS[src.adapter] ? src.adapter : detect(doc);
    const adapter = ADAPTERS[type];
    if (!adapter) throw new Error(`no adapter for ${type}`);
    const parsed = await adapter.parse(doc);

    const rsnap = await db().collection('restaurants').doc(id).get();
    const r = { id, ...rsnap.data() } as Restaurant;
    const prevSnap = await db().collection('menus').doc(id).get();
    const prev = prevSnap.exists ? (prevSnap.data() as Menu) : null;

    const draft = normalizeMenu({
      ...parsed, houseNotes: parsed.houseNotes ?? prev?.houseNotes,
      sourceUrl: src.url, sourceHash: doc.hash, verifiedAt: '', status: 'review'
    } as Menu);
    const { verifiedAt: _v, status: _s, ...d } = draft;
    const verdict = validate(draft, prev?.status === 'published' ? prev : null);

    await sref.set({ lastFetchedAt: FieldValue.serverTimestamp(), lastHash: doc.hash, adapter: type, failCount: 0 }, { merge: true });
    if (verdict.ok) { await publish(r, d, { reindex: false }); return 'published'; }
    await sendToReview(r, d, verdict.failures, rawPath);
    return 'review';
  } catch (e) {
    console.error(`[${id}]`, e instanceof RobotsDenied ? e.message : e);
    await sref.set({ failCount: FieldValue.increment(1), lastFetchedAt: FieldValue.serverTimestamp() }, { merge: true });
    return 'error';
  }
}

async function main() {
  const only = process.argv[2];
  const snap = only ? [await db().collection('sources').doc(only).get()] : (await db().collection('sources').get()).docs;
  const cutoff = Date.now() - WEEK;
  const tally: Record<string, number> = {};
  const cities = new Set<string>();
  for (const s of snap) {
    if (!s.exists) continue;
    const src = s.data() as Source;
    if (!only && src.lastFetchedAt && src.lastFetchedAt.toMillis() > cutoff) continue;
    // owner-edited and user-submitted menus aren't scraped on schedule (only when run explicitly)
    if (!only && src.pinned && (src.adapter === 'owner' || src.adapter === 'user')) continue;
    const out = await runOne(s.id, src);
    tally[out] = (tally[out] ?? 0) + 1;
    if (out === 'published') cities.add(s.id.split('--')[0]);
    console.log(`${out.padEnd(9)} ${s.id}`);
  }
  if (cities.size) await buildSearchIndex([...cities]);
  console.log(tally);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
