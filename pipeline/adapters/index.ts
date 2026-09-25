import type { SourceType } from '../../src/lib/types';
import type { Adapter } from '../types';
import { jsonld } from './jsonld';
import { html } from './html';
import { pdf } from './pdf';
import { image } from './image';
import { toast } from './toast';
import { square } from './square';
import { chownow } from './chownow';
import { clover } from './clover';

export const ADAPTERS: Partial<Record<SourceType, Adapter>> = { jsonld, html, pdf, image, toast, square, chownow, clover };
