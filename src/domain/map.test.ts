import { describe, expect, it } from 'vitest';
import { markerClassForStatus, toMapPlace } from './map';
import type { PlaceCard } from './places';

const card: PlaceCard = {
  id: 'moon-bowl', name: 'Moon Bowl', description: 'Fictional', fictional: true,
  location: { address: '1 Test', city: 'Givatayim', latitude: 32.0718, longitude: 34.8124, mapUrl: 'https://example.com' },
  status: 'visited', priceRange: '$$', tags: [], ramenStyles: ['shoyu'], dietaryOptions: [],
  coverImage: { src: 'cover.svg', alt: 'Cover' }, score: 8.25, visitCount: 2,
  latestVisit: '2026-06-18', addedAt: '2026-05-04', searchText: 'moon bowl',
};

describe('map place model', () => {
  it('contains only popup and coordinate data with a base-safe detail URL', () => {
    expect(toMapPlace(card, '/ramen-radar')).toEqual({
      id: 'moon-bowl', name: 'Moon Bowl', city: 'Givatayim', status: 'visited',
      priceRange: '$$', score: 8.25, latitude: 32.0718, longitude: 34.8124,
      detailUrl: '/ramen-radar/place/?id=moon-bowl',
    });
  });

  it.each([
    ['visited', 'map-marker--visited'],
    ['want-to-visit', 'map-marker--want-to-visit'],
    ['unavailable', 'map-marker--unavailable'],
  ] as const)('maps %s to an accessible marker class', (status, expected) => {
    expect(markerClassForStatus(status)).toBe(expected);
  });
});
