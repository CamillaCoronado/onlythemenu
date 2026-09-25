import type { ParamMatcher } from '@sveltejs/kit';
/** 'perry-ut', 'salt-lake-city-ut' */
export const match: ParamMatcher = (p) => /^[a-z0-9]+(?:-[a-z0-9]+)*-[a-z]{2}$/.test(p);
