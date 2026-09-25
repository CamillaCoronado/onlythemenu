// pure node: also imported by the pipeline scripts, so no $lib / $env aliases here.
import { get, put } from '@vercel/blob';
import type { Menu, Restaurant } from '../types';

/** true when a blob store is connected. otherwise the app reads /seed and writes nowhere. */
export const storeEnabled = Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

const INDEX = 'index.json';
const menuPath = (id: string) => `menus/${id}.json`;
const restaurantPath = (id: string) => `restaurants/${id}.json`;

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

export const getStoredMenu = (id: string) => readJson<Menu>(menuPath(id));
export const getStoredRestaurant = (id: string) => readJson<Restaurant>(restaurantPath(id));

/** every restaurant, kept as one blob so listing a city is a single read rather than a bucket scan */
export const getStoredIndex = (fresh = false) => readJson<Restaurant[]>(INDEX, fresh).then((r) => r ?? []);

export async function putRestaurant(r: Restaurant, m: Menu): Promise<void> {
  await Promise.all([writeJson(restaurantPath(r.id), r), writeJson(menuPath(r.id), m)]);
  const index = await getStoredIndex(true);
  const next = [...index.filter((x) => x.id !== r.id), r].sort((a, b) => a.id.localeCompare(b.id));
  await writeJson(INDEX, next);
}
