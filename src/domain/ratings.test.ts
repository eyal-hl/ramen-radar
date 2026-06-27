import { describe, expect, it } from 'vitest';
import { aggregatePlace, aggregateVisit, mean, scoreReview } from './ratings';
import type { Place, Review, Visit } from './place-schema';

const review = (reviewerId: string, ratings: Review['ratings']): Review => ({
  reviewerId,
  reviewerName: reviewerId,
  ratings,
});

const visit = (id: string, reviews: Review[]): Visit => ({
  id,
  date: '2026-06-01',
  photos: [],
  dishes: [],
  reviews,
});

const place = (visits: Visit[]): Place => ({
  id: 'test-place', fictional: true, name: 'Test Place', description: 'Test',
  status: visits.length ? 'visited' : 'want-to-visit', addedAt: '2026-06-01',
  location: { address: '1 Test', city: 'Givatayim', latitude: 32, longitude: 34, mapUrl: 'https://example.com' },
  links: {}, priceRange: '$$', currency: 'ILS', ramenStyles: [], dietaryOptions: [], tags: [],
  coverImage: { src: 'cover.svg', alt: 'Cover' }, gallery: [], visits,
});

describe('rating calculations', () => {
  it('returns null for an empty mean', () => expect(mean([])).toBeNull());

  it('keeps full precision when scoring a review', () => {
    expect(scoreReview(review('a', { broth: 8, noodles: 9, value: 9 }))).toBe(26 / 3);
  });

  it('weights reviewers equally when they submit different category counts', () => {
    const result = aggregateVisit(visit('v1', [
      review('focused', { broth: 10, noodles: 10 }),
      review('complete', { broth: 4, noodles: 4, toppings: 4, egg: 4, portion: 4, value: 4, service: 4, atmosphere: 4, wouldReturn: 4 }),
    ]));
    expect(result.overall).toBe(7);
  });

  it('aggregates category values across reviewers and repeat visits', () => {
    const result = aggregatePlace(place([
      visit('v1', [review('a', { broth: 10, noodles: 8 })]),
      visit('v2', [review('a', { broth: 6 }), review('b', { broth: 8, noodles: 6 })]),
    ]));
    expect(result.categories.broth).toBe(8);
    expect(result.categories.noodles).toBe(7);
    expect(result.reviewCount).toBe(3);
    expect(result.ratedVisitCount).toBe(2);
  });

  it('returns unrated aggregates when no scores were submitted', () => {
    const result = aggregatePlace(place([visit('v1', [review('a', {})])]));
    expect(result.overall).toBeNull();
    expect(result.reviewCount).toBe(0);
    expect(result.ratedVisitCount).toBe(0);
  });
});

