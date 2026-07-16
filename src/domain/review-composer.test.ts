import { describe, expect, it, vi } from 'vitest';
import type { FirestorePlace } from './firestore-model';
import type { Review, Visit } from './place-schema';
import {
  appendReviewToVisit,
  availableReviewers,
  createReview,
  nextUnratedRatingKey,
  reviewerIdFromName,
  saveReviewToVisit,
  setReviewRating,
} from './review-composer';

const review = (reviewerId: string, reviewerName: string, ratings: Review['ratings'] = {}): Review => ({
  reviewerId,
  reviewerName,
  ratings,
});

const visit = (id: string, reviews: Review[]): Visit => ({
  id,
  date: '2026-07-16',
  dishes: [],
  photos: [],
  reviews,
});

const place = (visits: Visit[]): FirestorePlace => ({
  id: 'test-ramen',
  fictional: false,
  name: 'Test Ramen',
  description: 'A test place.',
  status: 'visited',
  addedAt: '2026-07-16',
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
    alt: 'Placeholder bowl',
  },
  gallery: [],
  visits,
  archived: false,
  updatedAt: '2026-07-16T12:00:00.000Z',
});

describe('mobile review composer', () => {
  it('offers known reviewers who have not reviewed the selected visit', () => {
    const visits = [
      visit('lunch', [review('eyal', 'Eyal'), review('maya', 'Maya')]),
      visit('dinner', [review('eyal', 'Eyal')]),
    ];

    expect(availableReviewers(visits, visits[1])).toEqual([
      { reviewerId: 'maya', reviewerName: 'Maya' },
    ]);
  });

  it('derives a unique stable ID for a new reviewer without exposing an ID field', () => {
    expect(reviewerIdFromName('  Dana Levi  ', ['eyal'])).toBe('dana-levi');
    expect(reviewerIdFromName('Dana Levi', ['dana-levi'])).toBe('dana-levi-2');
    expect(reviewerIdFromName('דנה', ['reviewer', 'reviewer-2'])).toBe('reviewer-3');
  });

  it('creates a blank review for the chosen identity', () => {
    expect(createReview({ reviewerId: 'maya', reviewerName: 'Maya' })).toEqual({
      reviewerId: 'maya',
      reviewerName: 'Maya',
      ratings: {},
    });
  });

  it('sets and clears exact category scores without mutating the review', () => {
    const original = review('eyal', 'Eyal');
    const rated = setReviewRating(original, 'broth', 9);

    expect(rated.ratings).toEqual({ broth: 9 });
    expect(original.ratings).toEqual({});
    expect(setReviewRating(rated, 'broth', null).ratings).toEqual({});
  });

  it('advances to the next unrated category and wraps around', () => {
    expect(nextUnratedRatingKey({ broth: 9, toppings: 8 }, 'broth')).toBe('noodles');
    expect(nextUnratedRatingKey({ atmosphere: 7, wouldReturn: 8 }, 'atmosphere')).toBe('broth');
  });

  it('stays on the current category once every category has a score', () => {
    expect(nextUnratedRatingKey({
      broth: 8,
      noodles: 8,
      toppings: 8,
      egg: 8,
      portion: 8,
      value: 8,
      service: 8,
      atmosphere: 8,
      wouldReturn: 8,
    }, 'service')).toBe('service');
  });
});

describe('adding a review to a place', () => {
  it('immutably appends the review to the requested visit', () => {
    const original = place([visit('lunch', [review('eyal', 'Eyal', { broth: 8 })])]);
    const updated = appendReviewToVisit(original, 'lunch', review('maya', 'Maya', { noodles: 9 }));

    expect(updated.visits[0].reviews.map(({ reviewerId }) => reviewerId)).toEqual(['eyal', 'maya']);
    expect(original.visits[0].reviews.map(({ reviewerId }) => reviewerId)).toEqual(['eyal']);
  });

  it('rejects an unknown visit or a duplicate reviewer', () => {
    const original = place([visit('lunch', [review('eyal', 'Eyal')])]);

    expect(() => appendReviewToVisit(original, 'missing', review('maya', 'Maya')))
      .toThrow('Visit no longer exists');
    expect(() => appendReviewToVisit(original, 'lunch', review('eyal', 'Eyal')))
      .toThrow('already reviewed');
  });

  it('persists the appended review once against the current place version', async () => {
    const original = place([visit('lunch', [review('eyal', 'Eyal')])]);
    const persist = vi.fn(async (candidate: FirestorePlace, _expectedUpdatedAt: string | undefined) => ({
      ...candidate,
      updatedAt: '2026-07-16T13:00:00.000Z',
    }));

    const result = await saveReviewToVisit(
      original,
      'lunch',
      review('maya', 'Maya', { broth: 9 }),
      persist,
    );

    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({
        visits: [expect.objectContaining({
          reviews: [
            expect.objectContaining({ reviewerId: 'eyal' }),
            expect.objectContaining({ reviewerId: 'maya', ratings: { broth: 9 } }),
          ],
        })],
      }),
      original.updatedAt,
    );
    expect(result.updatedAt).toBe('2026-07-16T13:00:00.000Z');
    expect(result.visits[0].reviews.map(({ reviewerId }) => reviewerId)).toEqual(['eyal', 'maya']);
  });

  it('uses the returned version token for the next review save', async () => {
    const original = place([visit('lunch', [review('eyal', 'Eyal')])]);
    let version = 12;
    const persist = vi.fn(async (candidate: FirestorePlace, _expectedUpdatedAt: string | undefined) => ({
      ...candidate,
      updatedAt: `2026-07-16T${version++}:00:00.000Z`,
    }));

    const first = await saveReviewToVisit(original, 'lunch', review('maya', 'Maya'), persist);
    const second = await saveReviewToVisit(first, 'lunch', review('dan', 'Dan'), persist);

    expect(persist).toHaveBeenCalledTimes(2);
    expect(persist.mock.calls[1][1]).toBe(first.updatedAt);
    expect(second.visits[0].reviews.map(({ reviewerId }) => reviewerId)).toEqual(['eyal', 'maya', 'dan']);
  });
});
