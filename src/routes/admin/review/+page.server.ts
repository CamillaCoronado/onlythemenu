import { fail } from '@sveltejs/kit';
import { db, storage } from '$lib/server/firebase';
import { requireAdmin } from '$lib/server/guard';
import { pathsFor, revalidatePaths, writeMenu } from '$lib/server/publish';
import { applyPrice } from '$lib/server/reports';
import {
  dropReview, getReports, getReview, getStoredRestaurant, listReports, listReview,
  listSubmissions, patchSource, putReports, putSubmissions, storeEnabled, type Report
} from '$lib/server/store';
import { menuToText, textToMenu } from '$lib/menuText';
import type { Menu, Restaurant, SourceType } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

type Draft = Omit<Menu, 'verifiedAt' | 'status'>;
type Group = {
  key: string; restaurantId: string; sectionIdx: number; itemIdx: number; itemName: string;
  variantLabel?: string; prices: Record<number, number>; ids: string[];
};

async function signed(path?: string) {
  if (!path) return null;
  const [u] = await storage().bucket().file(path).getSignedUrl({ action: 'read', version: 'v4', expires: Date.now() + 15 * 60_000 });
  return u;
}

/** reports collapse to one row per item (+variant), with a tally of what people say the price is */
function group(rows: { id: string; restaurantId: string; sectionIdx: number; itemIdx: number; itemName: string; variantLabel?: string; reportedCents: number }[]): Group[] {
  const groups = new Map<string, Group>();
  for (const r of rows) {
    const key = `${r.restaurantId}|${r.sectionIdx}|${r.itemIdx}|${r.variantLabel ?? ''}`;
    const g = groups.get(key) ?? {
      key, restaurantId: r.restaurantId, sectionIdx: r.sectionIdx, itemIdx: r.itemIdx,
      itemName: r.itemName, ...(r.variantLabel && { variantLabel: r.variantLabel }), prices: {}, ids: []
    };
    g.prices[r.reportedCents] = (g.prices[r.reportedCents] ?? 0) + 1;
    g.ids.push(r.id);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.ids.length - a.ids.length);
}

export const load: PageServerLoad = async ({ locals, url }) => {
  requireAdmin(locals, url);

  if (storeEnabled) {
    const [queue, reports, subs] = await Promise.all([listReview(), listReports(), listSubmissions()]);
    return {
      queue: queue.map((x) => ({
        id: x.restaurantId, name: x.name, failures: x.failures,
        sourceType: x.draft.sourceType as SourceType, sourceUrl: x.draft.sourceUrl,
        text: menuToText(x.draft), raw: x.rawPath ? `/admin/raw/${x.rawPath}` : null,
        rawKind: String(x.rawPath ?? '').split('.').pop()
      })),
      // owner accounts are deferred while the site runs without an auth provider
      claims: [],
      reports: group(reports.filter((r) => r.status === 'open')),
      submissions: subs.filter((s) => s.status === 'open').map((s) => ({ id: s.id, url: s.url, restaurantId: s.restaurantId, photo: null }))
    };
  }

  const [rev, claims, reports, subs] = await Promise.all([
    db().collection('review').orderBy('createdAt').limit(25).get(),
    db().collection('claims').where('status', '==', 'open').limit(50).get(),
    db().collection('reports').where('status', '==', 'open').limit(300).get(),
    db().collection('submissions').where('status', '==', 'open').limit(50).get()
  ]);

  const queue = await Promise.all(rev.docs.map(async (d) => {
    const x = d.data();
    return { id: d.id, name: x.name, failures: x.failures as string[], sourceType: x.draft.sourceType as SourceType,
      sourceUrl: x.draft.sourceUrl as string, text: menuToText(x.draft as Draft), raw: await signed(x.rawPath), rawKind: String(x.rawPath ?? '').split('.').pop() };
  }));

  return {
    queue,
    claims: claims.docs.map((d) => ({ id: d.id, ...(d.data() as { uid: string; restaurantId: string; role: string; phone: string; proof: string }) })),
    reports: group(reports.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Report, 'id' | 'createdAt' | 'status'>) }))),
    submissions: await Promise.all(subs.docs.map(async (d) => ({ id: d.id, url: d.data().url as string | undefined, restaurantId: d.data().restaurantId as string | undefined, photo: await signed(d.data().photoPath) })))
  };
};

async function restaurant(id: string): Promise<Restaurant> {
  if (storeEnabled) {
    const r = await getStoredRestaurant(id);
    if (r) return r;
    const rev = await getReview(id);
    if (!rev) throw new Error(`no restaurant or review entry for ${id}`);
    return { id, citySlug: rev.citySlug, slug: rev.slug, name: rev.name, hasMenu: false } as Restaurant;
  }
  const s = await db().collection('restaurants').doc(id).get();
  return { id: s.id, ...s.data() } as Restaurant;
}

/** flip a set of reports to a final state, leaving the rest of that restaurant's rows alone */
async function closeReports(restaurantId: string, ids: string[], status: Report['status']) {
  const hit = new Set(ids);
  const rows = await getReports(restaurantId);
  await putReports(restaurantId, rows.map((r) => (hit.has(r.id) ? { ...r, status } : r)));
}

export const actions: Actions = {
  approve: async ({ locals, url, request }) => {
    requireAdmin(locals, url);
    const f = await request.formData();
    const id = String(f.get('id'));
    const draft = storeEnabled
      ? (await getReview(id))?.draft
      : ((await db().collection('review').doc(id).get()).data()?.draft as Draft | undefined);
    if (!draft) return fail(404, { err: 'gone' });

    // edit-then-approve: the textarea wins when it was changed
    const text = f.get('text');
    let sections = draft.sections, houseNotes = draft.houseNotes;
    if (typeof text === 'string' && text.trim() !== menuToText(draft).trim()) {
      const p = textToMenu(text);
      if (p.errors.length) return fail(400, { id, err: p.errors.map((e) => `line ${e.line}: ${e.message}`).join('; ') });
      sections = p.sections; houseNotes = p.houseNotes;
    }
    const r = await restaurant(id);
    await writeMenu(r, { houseNotes, sections, sourceUrl: draft.sourceUrl, sourceType: draft.sourceType, sourceHash: draft.sourceHash });
    await revalidatePaths(url.origin, pathsFor(r));
    return { ok: `published ${r.name}` };
  },

  reject: async ({ locals, url, request }) => {
    requireAdmin(locals, url);
    const id = String((await request.formData()).get('id'));
    if (storeEnabled) await dropReview(id);
    else await db().collection('review').doc(id).delete();
    return { ok: 'rejected' };
  },

  pin: async ({ locals, url, request }) => {
    requireAdmin(locals, url);
    const f = await request.formData();
    const adapter = String(f.get('adapter'));
    if (!['jsonld', 'html', 'pdf', 'image', 'toast', 'square', 'chownow', 'clover'].includes(adapter)) return fail(400, { err: 'bad adapter' });
    const id = String(f.get('id'));
    // next pipeline run re-parses with this adapter (clear lastHash so the unchanged page isn't skipped)
    if (storeEnabled) await patchSource(id, { adapter: adapter as SourceType, pinned: true, lastHash: null, lastFetchedAt: undefined });
    else await db().collection('sources').doc(id).set({ adapter, pinned: true, lastHash: null, lastFetchedAt: null }, { merge: true });
    return { ok: `pinned ${adapter}` };
  },

  claim: async ({ locals, url, request }) => {
    requireAdmin(locals, url);
    if (storeEnabled) return fail(503, { err: 'claims need an auth provider; owner accounts are off' });
    const f = await request.formData();
    const ref = db().collection('claims').doc(String(f.get('id')));
    const c = (await ref.get()).data();
    if (!c) return fail(404, { err: 'gone' });
    if (f.get('verdict') === 'approve') await db().collection('restaurants').doc(c.restaurantId).update({ claimedBy: c.uid });
    await ref.update({ status: f.get('verdict') === 'approve' ? 'approved' : 'rejected' });
    return { ok: 'claim handled' };
  },

  report: async ({ locals, url, request }) => {
    requireAdmin(locals, url);
    const f = await request.formData();
    const ids = String(f.get('ids')).split(',').filter(Boolean);
    const cents = Number(f.get('cents'));
    const restaurantId = String(f.get('restaurantId'));
    const apply = f.get('verdict') === 'apply';

    if (apply) {
      if (!Number.isInteger(cents)) return fail(400, { err: 'bad price' });
      const k = { restaurantId, sectionIdx: Number(f.get('sectionIdx')), itemIdx: Number(f.get('itemIdx')), itemName: String(f.get('itemName')), variantLabel: (f.get('variantLabel') as string) || undefined };
      if ((await applyPrice(k, cents)) === null) return fail(409, { err: 'item moved; reports are stale' });
      await revalidatePaths(url.origin, pathsFor(await restaurant(restaurantId)));
    }

    if (storeEnabled) await closeReports(restaurantId, ids, apply ? 'applied' : 'dismissed');
    else {
      const batch = db().batch();
      for (const id of ids) batch.update(db().collection('reports').doc(id), { status: apply ? 'applied' : 'dismissed' });
      await batch.commit();
    }
    return { ok: 'report handled' };
  },

  submission: async ({ locals, url, request }) => {
    requireAdmin(locals, url);
    const f = await request.formData();
    const id = String(f.get('id'));
    const status = String(f.get('verdict')) === 'done' ? 'done' : 'rejected';
    if (storeEnabled) {
      const rows = await listSubmissions();
      await putSubmissions(rows.map((s) => (s.id === id ? { ...s, status } : s)));
    } else await db().collection('submissions').doc(id).update({ status });
    return { ok: 'submission handled' };
  }
};
