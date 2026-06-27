import { describe, expect, it } from 'vitest';
import { z } from 'astro/zod';
import { createPlaceSchema } from './place-schema';

const plannedPlace = {
  id: 'future-bowl',
  fictional: true,
  name: 'Future Bowl',
  description: 'A fictional planned stop.',
  status: 'want-to-visit',
  addedAt: '2026-06-27',
  location: {
    address: '1 Example Street',
    city: 'Givatayim',
    latitude: 32.07,
    longitude: 34.81,
    mapUrl: 'https://maps.google.com/?q=32.07,34.81',
  },
  links: {},
  priceRange: '$$',
  currency: 'ILS',
  ramenStyles: ['shoyu'],
  dietaryOptions: [],
  tags: ['fictional'],
  coverImage: { src: '../../assets/places/future-bowl/cover.svg', alt: 'Illustrated ramen bowl' },
  gallery: [],
  visits: [],
};

const schema = createPlaceSchema(z.string());

describe('place content schema', () => {
  it('accepts a planned place without visits', () => {
    expect(schema.parse(plannedPlace).id).toBe('future-bowl');
  });

  it('rejects ratings outside the 1–10 range', () => {
    const value = structuredClone(plannedPlace);
    value.status = 'visited';
    value.visits = [{
      id: 'visit-1', date: '2026-06-20', dishes: [], photos: [],
      reviews: [{ reviewerId: 'eyal', reviewerName: 'Eyal', ratings: { broth: 11 } }],
    }] as never[];
    expect(() => schema.parse(value)).toThrow();
  });

  it('rejects duplicate visit IDs', () => {
    const visit = {
      id: 'visit-1', date: '2026-06-20', dishes: [], photos: [],
      reviews: [{ reviewerId: 'eyal', reviewerName: 'Eyal', ratings: { broth: 8 } }],
    };
    const value = { ...plannedPlace, status: 'visited', visits: [visit, visit] };
    expect(() => schema.parse(value)).toThrow(/visit IDs/i);
  });

  it('rejects duplicate reviewer IDs within one visit', () => {
    const review = { reviewerId: 'eyal', reviewerName: 'Eyal', ratings: { broth: 8 } };
    const value = {
      ...plannedPlace,
      status: 'visited',
      visits: [{ id: 'visit-1', date: '2026-06-20', dishes: [], photos: [], reviews: [review, review] }],
    };
    expect(() => schema.parse(value)).toThrow(/reviewer IDs/i);
  });

  it('rejects visited places without visits', () => {
    expect(() => schema.parse({ ...plannedPlace, status: 'visited' })).toThrow(/at least one visit/i);
  });

  it('requires accessible image alt text', () => {
    const value = { ...plannedPlace, coverImage: { src: 'cover.svg', alt: '' } };
    expect(() => schema.parse(value)).toThrow();
  });
});
