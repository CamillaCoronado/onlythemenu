/** pdf text items with x/y/font size -> shared line logic. */
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { groupLines, linesToSections, type Token } from './lines';
import { AdapterError, type Adapter, type Fetched } from '../types';

export async function pdfTokens(data: Uint8Array): Promise<Token[]> {
  const doc = await getDocument({ data, useSystemFonts: false, isEvalSupported: false }).promise;
  const tokens: Token[] = [];
  let yOffset = 0;
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const { height } = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    for (const it of content.items) {
      if (!('str' in it) || !it.str.trim()) continue;
      const [a, b, , , e, f] = it.transform as number[];
      tokens.push({ text: it.str, x: e, y: yOffset + (height - f), w: it.width, size: Math.hypot(a, b) });
    }
    yOffset += height; // stack pages vertically so sections continue across pages
  }
  return tokens;
}

export const pdf: Adapter = {
  name: 'pdf',
  async parse(doc: Fetched) {
    const tokens = await pdfTokens(new Uint8Array(doc.body));
    if (!tokens.length) throw new AdapterError('pdf has no text layer (scanned?) — route to image adapter');
    return { sourceType: 'pdf', sections: linesToSections(groupLines(tokens)) };
  }
};
