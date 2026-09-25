import type { Section, SourceType } from '../src/lib/types';

export type Fetched = { url: string; contentType: string; body: Buffer; text: string };
export type Parsed = { sourceType: SourceType; sections: Section[]; houseNotes?: string };
export type Adapter = { name: SourceType; parse(doc: Fetched): Promise<Parsed> | Parsed };

export class AdapterError extends Error {}
