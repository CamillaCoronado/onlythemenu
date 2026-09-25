import { db } from '$lib/server/firebase';
import { requireUser } from '$lib/server/guard';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const uid = requireUser(locals, url);
  const snap = await db().collection('restaurants').where('claimedBy', '==', uid).get();
  return { mine: snap.docs.map((d) => ({ id: d.id, name: d.data().name as string, citySlug: d.data().citySlug as string, slug: d.data().slug as string })) };
};
