import { describe, expect, it } from 'vitest';
import type { FirestorePlace } from './firestore-model';
import { toJournalEntries } from './journal';

const place = (id: string, name: string, date: string, score: number): FirestorePlace => ({
  id,
  fictional: false,
  name,
  description: `${name} description`,
  status: 'visited',
  addedAt: '2026-01-01',
  location: { address: '1 Test Street', city: 'Tel Aviv', latitude: 32, longitude: 34, mapUrl: 'https://maps.google.com/' },
  links: {},
  priceRange: '$$',
  currency: 'ILS',
  ramenStyles: ['shoyu'],
  dietaryOptions: [],
  tags: [],
  coverImage: { src: '/cover.svg', alt: `${name} bowl` },
  gallery: [],
  archived: false,
  visits: [{
    id: `${id}-visit`,
    date,
    notes: `Notes from ${name}`,
    photos: [],
    dishes: [{ name: 'Special ramen', notes: 'Extra egg' }],
    reviews: [{ reviewerId: 'eyal', reviewerName: 'Eyal', ratings: { broth: score, noodles: score - 1 } }],
  }],
});

describe('visit journal', () => {
  it('flattens visits newest first with useful place and bowl context', () => {
    const entries = toJournalEntries([
      place('older', 'Older Bowl', '2026-05-10', 8),
      place('newer', 'New Bowl', '2026-07-12', 10),
    ]);

    expect(entries.map(({ placeName }) => placeName)).toEqual(['New Bowl', 'Older Bowl']);
    expect(entries[0]).toMatchObject({
      placeId: 'newer',
      visitId: 'newer-visit',
      city: 'Tel Aviv',
      date: '2026-07-12',
      dishSummary: 'Special ramen',
      reviewerNames: ['Eyal'],
      score: 9.5,
    });
  });

  it('returns an empty journal when no visits have been logged', () => {
    const unvisited = { ...place('future', 'Future Bowl', '2026-07-12', 8), status: 'want-to-visit' as const, visits: [] };
    expect(toJournalEntries([unvisited])).toEqual([]);
  });
});
