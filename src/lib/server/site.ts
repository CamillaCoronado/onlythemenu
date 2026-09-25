import { env } from '$env/dynamic/private';
export const siteOrigin = (fallback: string) => (env.PUBLIC_SITE_URL || fallback).replace(/\/$/, '');
