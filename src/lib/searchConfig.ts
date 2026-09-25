import type { Options } from 'minisearch';
import type { SearchDoc } from './types';

/** shared by the index builder (pipeline) and the client loader — must match exactly */
export const SEARCH_OPTIONS: Options<SearchDoc> = {
  idField: 'id',
  fields: ['name', 'cuisine'],
  storeFields: ['slug', 'name', 'citySlug', 'cityName', 'lat', 'lng'],
  searchOptions: { boost: { name: 3 }, fuzzy: 0.2, prefix: true }
};
