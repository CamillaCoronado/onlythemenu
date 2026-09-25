import { describe, expect, it } from 'vitest';
import { slugify, toRestaurant } from './import-overture';

describe('overture mapping', () => {
  it('slugs', () => {
    expect(slugify("Angie's Restaurant")).toBe('angies-restaurant');
    expect(slugify('Café Sabor & Grill')).toBe('cafe-sabor-and-grill');
  });
  it('maps a row', () => {
    const r = toRestaurant({ id: 'abc', name: "Angie's", category: 'diner', confidence: 0.9, street: '690 N Main St', locality: 'Logan', region: 'UT',
      postcode: '84321-1234', phone: '+14357529252', website: 'https://angiesrest.com', lat: 41.74, lng: -111.83, datasets: 'meta,Foursquare' });
    expect(r).toMatchObject({ slug: 'angies', citySlug: 'logan-ut', address: '690 N Main St, Logan, UT 84321', phone: '(435) 752-9252', geo: { lat: 41.74, lng: -111.83 }, sources: ['meta', 'Foursquare'] });
  });
});
