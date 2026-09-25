import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { menuToText, textToMenu } from './menuText';

describe('owner text format', () => {
  for (const slug of ['maddox-ranch-house', 'maddox-drive-in', 'angies']) {
    it(`round-trips ${slug}`, () => {
      const seed = JSON.parse(readFileSync(`seed/${slug}.json`, 'utf8')).menu;
      const back = textToMenu(menuToText(seed));
      expect(back.errors).toEqual([]);
      expect(back.houseNotes).toBe(seed.houseNotes);
      expect(back.sections).toEqual(seed.sections);
    });
  }
  it('reports bad prices with line numbers', () => {
    const r = textToMenu('# Pies\nApple .... seven dollars\n');
    expect(r.errors).toEqual([{ line: 2, message: `can't read the price "seven dollars"` }]);
  });
});
