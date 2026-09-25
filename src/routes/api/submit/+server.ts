import { error, json, redirect } from '@sveltejs/kit';
import { FieldValue } from 'firebase-admin/firestore';
import { db, firebaseEnabled, storage } from '$lib/server/firebase';
import { allow } from '$lib/server/ratelimit';
import type { RequestHandler } from './$types';

const MAX_BYTES = 12 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  if (!(await allow(getClientAddress(), 'submit', 10, 3_600_000))) error(429, 'slow down');
  const form = await request.formData().catch(() => null);
  if (!form) error(400, 'bad form');

  const restaurantId = String(form.get('restaurantId') ?? '').slice(0, 120) || undefined;
  const rawUrl = String(form.get('url') ?? '').trim();
  const photo = form.get('photo');
  const hasPhoto = photo instanceof File && photo.size > 0;

  let url: string | undefined;
  if (rawUrl) {
    try {
      const u = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
      if (!/^https?:$/.test(u.protocol)) throw 0;
      url = u.toString();
    } catch { error(400, "that link doesn't look right"); }
  }
  if (!url && !hasPhoto) error(400, 'add a link or a photo');
  if (hasPhoto && (photo.size > MAX_BYTES || !IMAGE_TYPES.has(photo.type))) error(400, 'photo must be a jpg/png/webp/heic under 12 mb');

  if (firebaseEnabled) {
    const ref = db().collection('submissions').doc();
    let photoPath: string | undefined;
    if (hasPhoto) {
      photoPath = `submissions/${ref.id}/${Date.now()}.${photo.type.split('/')[1]}`;
      await storage().bucket().file(photoPath).save(Buffer.from(await photo.arrayBuffer()), { contentType: photo.type, resumable: false });
    }
    await ref.set({
      ...(restaurantId && { restaurantId }), ...(url && { url }), ...(photoPath && { photoPath }),
      createdAt: FieldValue.serverTimestamp(), status: 'open'
    });
  } else {
    console.info('[submit:dev]', { restaurantId, url, photo: hasPhoto ? photo.name : null });
  }

  if (request.headers.get('accept')?.includes('text/html')) redirect(303, '/add?ok=1');
  return json({ ok: true });
};
