/** polite fetch: robots.txt, identified UA, ≤1 req / host / 5s. raw snapshots go to Storage. */
import { createHash } from 'node:crypto';
import type { Fetched } from './types';

export const USER_AGENT = 'onlythemenu-bot/1.0 (+https://onlythemenu.com/about)';
const HOST_GAP_MS = 5_000;
const lastHit = new Map<string, number>();
const robotsCache = new Map<string, string[]>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function politeWait(host: string) {
  const wait = (lastHit.get(host) ?? 0) + HOST_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastHit.set(host, Date.now());
}

/** Disallow rules that apply to us (our UA group, else *) */
export function parseRobots(txt: string, ua = 'onlythemenu-bot'): string[] {
  const groups: { agents: string[]; dis: string[] }[] = [];
  let g: { agents: string[]; dis: string[] } | null = null;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const [, k, v] = m;
    if (k.toLowerCase() === 'user-agent') {
      if (!g || g.dis.length) { g = { agents: [], dis: [] }; groups.push(g); }
      g.agents.push(v.toLowerCase());
    } else if (k.toLowerCase() === 'disallow' && g) g.dis.push(v);
  }
  const mine = groups.find((x) => x.agents.some((a) => a !== '*' && ua.toLowerCase().includes(a)));
  return (mine ?? groups.find((x) => x.agents.includes('*')))?.dis.filter(Boolean) ?? [];
}

export function robotsAllows(disallow: string[], path: string): boolean {
  return !disallow.some((rule) => {
    const re = new RegExp('^' + rule.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
    return re.test(path);
  });
}

async function allowed(url: URL): Promise<boolean> {
  let rules = robotsCache.get(url.origin);
  if (!rules) {
    await politeWait(url.host);
    const res = await fetch(`${url.origin}/robots.txt`, { headers: { 'user-agent': USER_AGENT } }).catch(() => null);
    rules = res?.ok ? parseRobots(await res.text()) : [];
    robotsCache.set(url.origin, rules);
  }
  return robotsAllows(rules, url.pathname + url.search);
}

export class RobotsDenied extends Error {}

export async function politeFetch(raw: string): Promise<Fetched & { hash: string }> {
  const url = new URL(raw);
  if (!(await allowed(url))) throw new RobotsDenied(`robots.txt disallows ${url}`);
  await politeWait(url.host);
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/pdf,image/*;q=0.8,*/*;q=0.5' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
  const body = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
  return {
    url: res.url || url.toString(), contentType, body,
    text: /text|html|json|xml/.test(contentType) ? body.toString('utf8') : '',
    hash: sha256(body)
  };
}

export const sha256 = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');

export function extFor(contentType: string): string {
  if (contentType.includes('pdf')) return 'pdf';
  const img = contentType.match(/image\/(\w+)/);
  if (img) return img[1] === 'jpeg' ? 'jpg' : img[1];
  return 'html';
}
