import { error, fail } from '@sveltejs/kit';
import { db } from '$lib/server/firebase';
import { requireUser } from '$lib/server/guard';
import { pathsFor, revalidatePaths, writeMenu } from '$lib/server/publish';
import { menuToText, textToMenu } from '$lib/menuText';
import { validate } from '../../../../pipeline/validate';
import type { Menu, Restaurant } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

async function owned(id: string, uid: string, isAdmin: boolean) {
  const snap = await db().collection('restaurants').doc(id).get();
  if (!snap.exists) error(404, 'not found');
  const r = { id: snap.id, ...snap.data() } as Restaurant;
  if (r.claimedBy !== uid && !isAdmin) error(403, 'not your restaurant');
  return r;
}

export const load: PageServerLoad = async ({ params, locals, url }) => {
  const uid = requireUser(locals, url);
  const r = await owned(params.id, uid, locals.isAdmin);
  const m = await db().collection('menus').doc(r.id).get();
  const menu = m.exists ? (m.data() as Menu) : null;
  return { r: { id: r.id, name: r.name, citySlug: r.citySlug, slug: r.slug, orderUrl: r.orderUrl ?? '' }, text: menu ? menuToText(menu) : '# menu\n' };
};

export const actions: Actions = {
  default: async ({ params, locals, url, request }) => {
    const uid = requireUser(locals, url);
    const r = await owned(params.id, uid, locals.isAdmin);
    const f = await request.formData();
    const text = String(f.get('text') ?? '').slice(0, 100_000);
    const orderUrl = String(f.get('orderUrl') ?? '').trim();
    const parsed = textToMenu(text);
    if (parsed.errors.length) return fail(400, { text, errors: parsed.errors.map((e) => `line ${e.line}: ${e.message}`) });
    // owners know their own prices, so change-vs-last rules don't apply; absolute sanity rules still do
    const v = validate({ ...parsed, sourceUrl: '', sourceType: 'owner', sourceHash: '', verifiedAt: '', status: 'review' });
    if (!v.ok) return fail(400, { text, errors: v.failures });
    if (orderUrl && !/^https:\/\//.test(orderUrl)) return fail(400, { text, errors: ['ordering link must start with https://'] });

    await writeMenu(r, { houseNotes: parsed.houseNotes, sections: parsed.sections, sourceUrl: `${url.origin}/${r.citySlug}/${r.slug}`, sourceType: 'owner' });
    await db().collection('restaurants').doc(r.id).set(orderUrl ? { orderUrl } : {}, { merge: true });
    await revalidatePaths(url.origin, pathsFor(r));
    return { ok: true, text };
  }
};
