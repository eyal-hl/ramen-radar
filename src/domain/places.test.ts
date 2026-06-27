import { describe, expect, it } from 'vitest';
import { sortPlaceCards, toPlaceCard, type PlaceCard } from './places';
import type { Place } from './place-schema';

const card = (name: string, score: number | null): PlaceCard => ({
  id: name.toLowerCase(), name, description: '', fictional: false,
  location: { address: '', city: 'Givatayim', latitude: 0, longitude: 0, mapUrl: 'https://example.com' },
  status: 'visited', priceRange: '$$', tags: [], ramenStyles: [], dietaryOptions: [],
  coverImage: { src: 'cover.svg', alt: 'Cover' }, score, visitCount: 1,
  latestVisit: '2026-06-01', addedAt: '2026-01-01', searchText: name.toLowerCase(),
});

describe('place view models', () => {
  it('sorts high scores first, unrated last, then alphabetically', () => {
    const sorted = sortPlaceCards([card('Zulu', null), card('Beta', 8), card('Alpha', 8)], 'rating');
    expect(sorted.map((item) => item.name)).toEqual(['Alpha', 'Beta', 'Zulu']);
  });

  it('normalizes searchable fields and extracts the latest visit', () => {
    const place = {
      id: 'spice-moon', fictional: false, name: 'Spice Moon', description: 'Cozy bowls',
      status: 'visited', addedAt: '2026-01-01',
      location: { address: '1 Test', city: 'Tel Aviv', latitude: 32, longitude: 34, mapUrl: 'https://example.com' },
      links: {}, priceRange: '$$', currency: 'ILS', ramenStyles: ['Miso'], dietaryOptions: ['Vegan'], tags: ['Late Night'],
      coverImage: { src: 'cover.svg', alt: 'Cover' }, gallery: [],
      visits: [
        { id: 'old', date: '2026-01-02', photos: [], dishes: [], reviews: [{ reviewerId: 'a', reviewerName: 'A', ratings: { broth: 8 } }] },
        { id: 'new', date: '2026-05-04', photos: [], dishes: [], reviews: [{ reviewerId: 'a', reviewerName: 'A', ratings: { broth: 9 } }] },
      ],
    } as Place;
    const result = toPlaceCard(place);
    expect(result.latestVisit).toBe('2026-05-04');
    expect(result.searchText).toContain('spice moon tel aviv miso vegan late night');
  });

  it('keeps unrated places in card data', () => {
    expect(card('Future', null).score).toBeNull();
  });
});
