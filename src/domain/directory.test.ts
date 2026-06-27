import { describe, expect, it } from 'vitest';
import { matchesDirectoryFilters, type DirectoryFilters } from './directory';
import type { PlaceCard } from './places';

const card: PlaceCard = {
  id: 'moon-bowl', name: 'Moon Bowl', description: 'Cozy bowls', fictional: true,
  location: { address: '1 Test', city: 'Givatayim', latitude: 32, longitude: 34, mapUrl: 'https://example.com' },
  status: 'visited', priceRange: '$$', tags: ['Late Night'], ramenStyles: ['Shoyu'], dietaryOptions: ['Vegan option'],
  coverImage: { src: 'cover.svg', alt: 'Cover' }, score: 8.4, visitCount: 2,
  latestVisit: '2026-06-01', addedAt: '2026-01-01',
  searchText: 'moon bowl givatayim shoyu vegan option late night cozy bowls',
};

const filters = (changes: Partial<DirectoryFilters> = {}): DirectoryFilters => ({
  query: '', status: '', city: '', style: '', diet: '', price: '', minimumScore: 0, ...changes,
});

describe('directory filters', () => {
  it('matches normalized text searches', () => {
    expect(matchesDirectoryFilters(card, filters({ query: 'VEGAN' }))).toBe(true);
    expect(matchesDirectoryFilters(card, filters({ query: 'tonkotsu' }))).toBe(false);
  });

  it.each([
    ['status', 'visited', true], ['status', 'want-to-visit', false],
    ['city', 'Givatayim', true], ['style', 'Shoyu', true],
    ['diet', 'Vegan option', true], ['price', '$$', true],
  ] as const)('filters by %s', (key, value, expected) => {
    expect(matchesDirectoryFilters(card, filters({ [key]: value }))).toBe(expected);
  });

  it('requires every active filter to match', () => {
    expect(matchesDirectoryFilters(card, filters({ city: 'Givatayim', style: 'Shoyu', minimumScore: 9 }))).toBe(false);
  });

  it('excludes unrated places only when a minimum score is active', () => {
    const unrated = { ...card, score: null };
    expect(matchesDirectoryFilters(unrated, filters())).toBe(true);
    expect(matchesDirectoryFilters(unrated, filters({ minimumScore: 1 }))).toBe(false);
  });
});
