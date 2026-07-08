import { describe, expect, test } from 'vitest';
import {
  parsePlaceDocument,
  publicPlaces,
  resolveImageSource,
  toFirestorePlace,
} from './firestore-model';

const placeFixture = {
  id: 'test-ramen',
  fictional: false,
  name: 'Test Ramen',
  description: 'A compact Firestore model test fixture.',
  status: 'want-to-visit',
  addedAt: '2026-07-06',
  location: {
    address: '1 Test Street',
    city: 'Givatayim',
    latitude: 32.07,
    longitude: 34.81,
    mapUrl: 'https://maps.google.com/',
  },
  links: {},
  priceRange: '$$',
  currency: 'ILS',
  ramenStyles: [],
  dietaryOptions: [],
  tags: [],
  coverImage: {
    src: '/images/places/unvisited/placeholder.svg',
    alt: 'Placeholder ramen bowl',
  },
  gallery: [],
  visits: [],
};

describe('Firestore place model', () => {
  test('accepts repository image paths and HTTPS image URLs', () => {
    const local = structuredClone(placeFixture);
    local.coverImage.src = '/images/places/moon-bowl-ramen/cover.svg';
    expect(parsePlaceDocument(local).coverImage.src).toBe(local.coverImage.src);

    const remote = structuredClone(local);
    remote.coverImage.src = 'https://images.example.com/ramen.jpg';
    expect(parsePlaceDocument(remote).coverImage.src).toBe(remote.coverImage.src);
  });

  test('rejects unsafe image schemes', () => {
    const place = structuredClone(placeFixture);
    place.coverImage.src = 'javascript:alert(1)';
    expect(() => parsePlaceDocument(place)).toThrow();
  });

  test('filters archived documents from public results', () => {
    const active = toFirestorePlace(parsePlaceDocument(placeFixture), '2026-07-06T10:00:00.000Z');
    const archived = { ...active, id: 'archived-place', archived: true };
    expect(publicPlaces([archived, active]).map(({ id }) => id)).toEqual([active.id]);
  });

  test('preserves an existing update token when parsing a document', () => {
    const place = {
      ...placeFixture,
      updatedAt: '2026-07-06T10:00:00.000Z',
      archived: false,
    };
    expect(parsePlaceDocument(place).updatedAt).toBe(place.updatedAt);
  });

  test('resolves repository paths under the GitHub Pages base', () => {
    expect(resolveImageSource('/images/places/example.jpg', '/ramen-radar/'))
      .toBe('/ramen-radar/images/places/example.jpg');
    expect(resolveImageSource('https://images.example.com/example.jpg', '/ramen-radar/'))
      .toBe('https://images.example.com/example.jpg');
  });
});
