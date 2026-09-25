export type Tag = 'V' | 'VG' | 'GF' | 'spicy';

export type Variant = { label: string; priceCents: number };

export type Item = {
  name: string;
  description?: string; // max 160 chars
  priceCents?: number; // undefined + marketPrice=true -> MKT
  marketPrice?: boolean;
  variants?: Variant[];
  tags?: Tag[];
};

export type Section = { title: string; note?: string; items: Item[] };

export type SourceType =
  | 'jsonld' | 'toast' | 'square' | 'chownow' | 'clover'
  | 'html' | 'pdf' | 'image' | 'owner' | 'user';

export type Menu = {
  houseNotes?: string;
  sections: Section[];
  sourceUrl: string;
  sourceType: SourceType;
  sourceHash: string;
  /** ISO string once it leaves the server (Firestore Timestamp is converted in the loader) */
  verifiedAt: string;
  status: 'published' | 'review';
};

export type Geo = { lat: number; lng: number };

export type Restaurant = {
  id: string;
  slug: string;
  citySlug: string;
  name: string;
  address: string;
  phone?: string;
  website?: string;
  orderUrl?: string;
  geo: Geo | null;
  cuisine?: string[];
  overtureId?: string;
  claimedBy?: string;
  hasMenu: boolean;
};

export type City = { slug: string; name: string; lat: number; lng: number };

export type SearchDoc = {
  id: string;
  slug: string;
  name: string;
  citySlug: string;
  cityName: string;
  cuisine: string;
  lat: number | null;
  lng: number | null;
};
