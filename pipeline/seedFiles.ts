import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fromSeed, type SeedFile } from '../src/lib/seed';

export const SEED_DIR = join(import.meta.dirname, '..', 'seed');

export function readSeeds() {
  return readdirSync(SEED_DIR).filter((f) => f.endsWith('.json')).sort().map((f) => {
    const raw = readFileSync(join(SEED_DIR, f), 'utf8');
    return { file: f, raw, ...fromSeed(JSON.parse(raw) as SeedFile) };
  });
}
