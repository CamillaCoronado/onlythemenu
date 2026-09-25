import { error, fail } from '@sveltejs/kit';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '$lib/server/firebase';
import { requireUser } from '$lib/server/guard';
import type { Restaurant } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

/** [slug] is the restaurant id ('perry-ut--maddox-ranch-house'): bare slugs collide across cities */
async function get(id: string) {
  const snap = await db().collection('restaurants').doc(id).get();
  if (!snap.exists) error(404, "we don't know that one yet");
  return { id: snap.id, ...snap.data() } as Restaurant;
}

export const load: PageServerLoad = async ({ params, locals, url }) => {
  const uid = requireUser(locals, url);
  const r = await get(params.slug);
  const mine = await db().collection('claims').where('uid', '==', uid).where('restaurantId', '==', r.id).limit(1).get();
  return { r: { id: r.id, name: r.name, address: r.address }, claimedByMe: r.claimedBy === uid, claimedByOther: !!r.claimedBy && r.claimedBy !== uid, pending: !mine.empty && mine.docs[0].data().status === 'open' };
};

export const actions: Actions = {
  default: async ({ params, locals, url, request }) => {
    const uid = requireUser(locals, url);
    const r = await get(params.slug);
    const f = await request.formData();
    const role = String(f.get('role') ?? '').slice(0, 80).trim();
    const phone = String(f.get('phone') ?? '').slice(0, 40).trim();
    const proof = String(f.get('proof') ?? '').slice(0, 500).trim();
    if (!role || !phone) return fail(400, { err: 'role and a phone we can call are required' });
    // a human verifies by calling the restaurant's listed number; nothing is granted automatically
    await db().collection('claims').add({ uid, restaurantId: r.id, role, phone, proof, status: 'open', createdAt: FieldValue.serverTimestamp() });
    return { ok: true };
  }
};
