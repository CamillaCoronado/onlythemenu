/** tesseract.js OCR -> words with boxes -> shared line logic. always lands in review (validate.ts). */
import { groupLines, linesToSections, type Token } from './lines';
import type { Adapter, Fetched } from '../types';

export async function ocrTokens(image: Buffer): Promise<Token[]> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  try {
    const { data } = await worker.recognize(image, {}, { blocks: true });
    const words = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)));
    return words
      .filter((w) => w.confidence >= 50)
      .map((w) => ({ text: w.text, x: w.bbox.x0, y: (w.bbox.y0 + w.bbox.y1) / 2, w: w.bbox.x1 - w.bbox.x0, size: w.bbox.y1 - w.bbox.y0 }));
  } finally {
    await worker.terminate();
  }
}

export const image: Adapter = {
  name: 'image',
  async parse(doc: Fetched) {
    return { sourceType: 'image', sections: linesToSections(groupLines(await ocrTokens(doc.body))) };
  }
};
