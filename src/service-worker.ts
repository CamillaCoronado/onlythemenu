/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;
const SHELL = `shell-${version}`;
const MENUS = 'menus-v1';
const MAX_MENUS = 20;
const MENU_PATH = /^\/[a-z0-9-]+-[a-z]{2}\/[a-z0-9-]+\/?(__data\.json)?$/;

sw.addEventListener('install', (e) => {
  const assets = [...build, ...files.filter((f) => f.startsWith('/fonts/') || f === '/favicon.svg')];
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(assets)).then(() => sw.skipWaiting()));
});

sw.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== MENUS).map((k) => caches.delete(k))))
      .then(() => sw.clients.claim())
  );
});

/** keep the most recently viewed MAX_MENUS menus (html + __data.json count as one menu) */
async function trim(cache: Cache) {
  const keys = await cache.keys();
  const menus = [...new Set(keys.map((k) => new URL(k.url).pathname.replace(/\/__data\.json$/, '')))];
  // cache.keys() is insertion-ordered; we re-put on every view so the oldest are first
  const drop = menus.slice(0, Math.max(0, menus.length - MAX_MENUS));
  await Promise.all(keys.filter((k) => drop.includes(new URL(k.url).pathname.replace(/\/__data\.json$/, ''))).map((k) => cache.delete(k)));
}

sw.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (build.includes(url.pathname) || url.pathname.startsWith('/fonts/')) {
    e.respondWith(caches.match(req).then((hit) => hit ?? fetch(req)));
    return;
  }

  if (MENU_PATH.test(url.pathname)) {
    e.respondWith((async () => {
      const cache = await caches.open(MENUS);
      try {
        const res = await fetch(req);
        if (res.ok) {
          await cache.delete(req);
          await cache.put(req, res.clone());
          e.waitUntil(trim(cache));
        }
        return res;
      } catch {
        const hit = await cache.match(req);
        if (hit) return hit;
        throw new Error('offline and not cached');
      }
    })());
  }
});
