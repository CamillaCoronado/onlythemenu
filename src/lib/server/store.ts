// pure node: also imported by the pipeline scripts, so no $lib / $env aliases here.
import { del, get, list, put } from '@vercel/blob';
import type { Menu, Restaurant, SourceType } from '../types';

/** true when a blob store is connected. otherwise the app reads /seed and writes nowhere. */
export const storeEnabled = Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

export type Draft = Omit<Menu, 'verifiedAt' | 'status'>;

export type ReviewEntry = {
  restaurantId: string; citySlug: string; slug: string; name: string;
  draft: Draft; failures: string[]; rawPath?: string; createdAt: string;
};

export type Report = {
  id: string; restaurantId: string; sectionIdx: number; itemIdx: number; itemName: string;
  variantLabel?: string; reportedCents: number; createdAt: string;
  status: 'open' | 'applied' | 'dismissed';
};

export type Source = {
  url: string; adapter?: SourceType; pinned?: boolean;
  lastFetchedAt?: string; lastHash?: string | null; failCount?: number;
};

export type Submission = { id: string; url?: string; restaurantId?: string; status: string; createdAt: string };

const INDEX = 'index.json';
const SUBMISSIONS = 'submissions.json';
const menuPath = (id: string) => `menus/${id}.json`;
const restaurantPath = (id: string) => `restaurants/${id}.json`;
const reviewPath = (id: string) => `review/${id}.json`;
const reportsPath = (id: string) => `reports/${id}.json`;
const sourcePath = (id: string) => `sources/${id}.json`;

async function readJson<T>(pathname: string, fresh = false): Promise<T | null> {
  const res = await get(pathname, { access: 'private', ...(fresh && { useCache: false }) }).catch(() => null);
  if (!res || res.statusCode !== 200) return null;
  return JSON.parse(await new Response(res.stream).text()) as T;
}

async function writeJson(pathname: string, value: unknown): Promise<void> {
  await put(pathname, JSON.stringify(value), {
    access: 'private',
    contentType: 'application/json',
    allowOverwrite: true
  });
}

const remove = (pathname: string | string[]) => del(pathname).catch(() => undefined);

/** every json under a prefix. the collections it is used on stay small (review queue, open reports). */
async function readAll<T>(prefix: string, limit = 500): Promise<T[]> {
  const { blobs } = await list({ prefix, limit });
  const rows: (T | null)[] = await Promise.all(blobs.map((b) => readJson<T>(b.pathname, true)));
  return rows.filter((r): r is T => r !== null);
}

// these read uncached: pages are ISR-cached at the edge, so a blob read only happens on
// regeneration, and a cached read there would republish the price a correction just changed.
export const getStoredMenu = (id: string) => readJson<Menu>(menuPath(id), true);
export const getStoredRestaurant = (id: string) => readJson<Restaurant>(restaurantPath(id), true);

/** every restaurant, kept as one blob so listing a city is a single read rather than a bucket scan */
export const getStoredIndex = (fresh = true) => readJson<Restaurant[]>(INDEX, fresh).then((r) => r ?? []);

export async function putRestaurant(r: Restaurant, m: Menu): Promise<void> {
  await Promise.all([writeJson(restaurantPath(r.id), r), writeJson(menuPath(r.id), m)]);
  const index = await getStoredIndex(true);
  const next = [...index.filter((x) => x.id !== r.id), r].sort((a, b) => a.id.localeCompare(b.id));
  await writeJson(INDEX, next);
}

/** bulk upsert. writes the index once at the end rather than once per row. */
export async function putRestaurants(rows: Restaurant[]): Promise<void> {
  for (let i = 0; i < rows.length; i += 20) {
    await Promise.all(rows.slice(i, i + 20).map((r) => writeJson(restaurantPath(r.id), r)));
  }
  const index = await getStoredIndex(true);
  const merged = new Map(index.map((r) => [r.id, r]));
  for (const r of rows) merged.set(r.id, r);
  await writeJson(INDEX, [...merged.values()].sort((a, b) => a.id.localeCompare(b.id)));
}

/** publish a draft: snapshot whatever menu is there, write the new one, drop it from review. */
export async function putMenu(r: Restaurant, draft: Draft, verifiedAt = new Date().toISOString()): Promise<void> {
  const prev = await getStoredMenu(r.id);
  if (prev) await writeJson(`history/${r.id}/${verifiedAt}.json`, prev);
  await putRestaurant({ ...r, hasMenu: true }, { ...draft, verifiedAt, status: 'published' } as Menu);
  await remove(reviewPath(r.id));
}

/** overwrite a published menu in place (a price correction), snapshotting the previous one */
export async function patchMenu(id: string, sections: Menu['sections']): Promise<void> {
  const prev = await getStoredMenu(id);
  if (!prev) return;
  await writeJson(`history/${id}/${new Date().toISOString()}.json`, prev);
  await writeJson(menuPath(id), { ...prev, sections });
}

export const getReview = (id: string) => readJson<ReviewEntry>(reviewPath(id), true);
export const listReview = (limit = 25) => readAll<ReviewEntry>('review/', limit);
export const dropReview = (id: string) => remove(reviewPath(id));
export const putReview = (e: ReviewEntry) => writeJson(reviewPath(e.restaurantId), e);

export const getReports = (restaurantId: string) => readJson<Report[]>(reportsPath(restaurantId), true).then((r) => r ?? []);
export const putReports = (restaurantId: string, rows: Report[]) => writeJson(reportsPath(restaurantId), rows);
export const listReports = (limit = 300) => readAll<Report[]>('reports/', limit).then((g) => g.flat());

export const getSource = (id: string) => readJson<Source>(sourcePath(id), true);
export const listSources = () => readAll<Source & { id?: string }>('sources/');

export async function patchSource(id: string, patch: Partial<Source>): Promise<void> {
  await writeJson(sourcePath(id), { ...((await getSource(id)) ?? {}), ...patch, id });
}

export const listSubmissions = () => readJson<Submission[]>(SUBMISSIONS, true).then((r) => r ?? []);
export const putSubmissions = (rows: Submission[]) => writeJson(SUBMISSIONS, rows);

/** the raw page a review entry was parsed from, kept so an admin can look at the original */
export async function putRaw(pathname: string, body: Buffer | string, contentType: string): Promise<void> {
  await put(pathname, body, { access: 'private', contentType, allowOverwrite: true });
}
