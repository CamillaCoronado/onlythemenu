/** order (brief §6): JSON-LD Menu -> known ordering platform -> pdf -> image -> generic html */
import type { SourceType } from '../src/lib/types';
import { findMenus, jsonLdBlocks } from './adapters/jsonld';
import type { Fetched } from './types';

/**
 * `sig` must be the platform's own app state, never a mention of its domain: a restaurant's
 * menu page linking to "order on toast" is still the restaurant's page, and matching the bare
 * domain sent those to the platform adapter instead of parsing the html sitting right there.
 */
const PLATFORMS: { type: SourceType; hosts: RegExp; sig: RegExp }[] = [
  { type: 'toast', hosts: /(^|\.)toasttab\.com$/, sig: /__TOAST_|window\.__OO_STATE__/ },
  { type: 'square', hosts: /(^|\.)square\.site$|(^|\.)squareup\.com$/, sig: /__BOOTSTRAP_STATE__/ },
  { type: 'chownow', hosts: /(^|\.)chownow\.com$/, sig: /cn-ordering/ },
  { type: 'clover', hosts: /(^|\.)clover\.com$/, sig: /cloverOnlineOrdering/ }
];

export function detect(doc: Fetched): SourceType {
  const ct = doc.contentType.toLowerCase();
  const isHtml = ct.includes('html');
  if (isHtml && jsonLdBlocks(doc.text).some((b) => findMenus(b).length)) return 'jsonld';
  const host = new URL(doc.url).hostname;
  for (const p of PLATFORMS) if (p.hosts.test(host) || (isHtml && p.sig.test(doc.text))) return p.type;
  if (ct.includes('pdf') || doc.body.subarray(0, 5).toString() === '%PDF-') return 'pdf';
  if (ct.startsWith('image/')) return 'image';
  return 'html';
}
