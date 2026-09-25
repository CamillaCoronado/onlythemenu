import { createHash } from 'node:crypto';

import { db, firebaseEnabled } from './firebase';

const mem = new Map<string, { n: number; reset: number }>();

/** per-ip fixed window. firestore-backed when available (shared across lambdas), in-memory otherwise. ips are hashed, never stored raw. */
export async function allow(ip: string, bucket: string, max: number, windowMs: number): Promise<boolean> {
  const key = createHash('sha256').update(`${bucket}:${ip}`).digest('hex').slice(0, 32);
  const now = Date.now();
  const win = Math.floor(now / windowMs);
  if (!firebaseEnabled) {
    const e = mem.get(key);
    if (!e || e.reset <= now) { mem.set(key, { n: 1, reset: (win + 1) * windowMs }); return true; }
    return ++e.n <= max;
  }
  const ref = db().collection('ratelimits').doc(`${key}_${win}`);
  const n = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const next = (snap.exists ? (snap.data()!.n as number) : 0) + 1;
    tx.set(ref, { n: next, expiresAt: new Date((win + 1) * windowMs) }, { merge: true });
    return next;
  });
  return n <= max;
}

