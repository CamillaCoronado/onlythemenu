import { env } from '$env/dynamic/private';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getStorage, type Storage } from 'firebase-admin/storage';

/** true when FIREBASE_* creds are present. otherwise the app reads /seed and writes nowhere. */
export const firebaseEnabled = Boolean(env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY);

let app: App | undefined;

function getApp(): App {
  if (!firebaseEnabled) throw new Error('firebase not configured (FIREBASE_* env vars missing)');
  if (app) return app;
  app = getApps()[0] ?? initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n')
    }),
    storageBucket: env.FIREBASE_STORAGE_BUCKET
  });
  return app;
}

export const db = (): Firestore => getFirestore(getApp());
export const auth = (): Auth => getAuth(getApp());
export const storage = (): Storage => getStorage(getApp());
