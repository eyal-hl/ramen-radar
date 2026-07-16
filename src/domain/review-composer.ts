import type { FirestorePlace } from './firestore-model';
import { ratingKeys, type RatingKey, type Ratings, type Review, type Visit } from './place-schema';

export interface ReviewerIdentity {
  reviewerId: string;
  reviewerName: string;
}

export function knownReviewers(visits: Visit[]): ReviewerIdentity[] {
  const reviewers = new Map<string, ReviewerIdentity>();
  for (const visit of visits) {
    for (const { reviewerId, reviewerName } of visit.reviews) {
      if (!reviewers.has(reviewerId)) reviewers.set(reviewerId, { reviewerId, reviewerName });
    }
  }
  return [...reviewers.values()].sort((left, right) => left.reviewerName.localeCompare(right.reviewerName));
}

export function availableReviewers(visits: Visit[], selectedVisit: Visit): ReviewerIdentity[] {
  const usedIds = new Set(selectedVisit.reviews.map(({ reviewerId }) => reviewerId));
  return knownReviewers(visits).filter(({ reviewerId }) => !usedIds.has(reviewerId));
}

export function reviewerIdFromName(name: string, existingIds: Iterable<string>): string {
  const usedIds = new Set(existingIds);
  const preferred = name
    .toLocaleLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'reviewer';
  if (!usedIds.has(preferred)) return preferred;

  let suffix = 2;
  while (usedIds.has(`${preferred}-${suffix}`)) suffix += 1;
  return `${preferred}-${suffix}`;
}

export function createReview(identity: ReviewerIdentity): Review {
  return { ...identity, ratings: {} };
}

export function setReviewRating(review: Review, key: RatingKey, score: number | null): Review {
  const ratings = { ...review.ratings };
  if (score === null) delete ratings[key];
  else ratings[key] = score;
  return { ...review, ratings };
}

export function nextUnratedRatingKey(ratings: Ratings, current: RatingKey): RatingKey {
  const currentIndex = ratingKeys.indexOf(current);
  for (let offset = 1; offset < ratingKeys.length; offset += 1) {
    const key = ratingKeys[(currentIndex + offset) % ratingKeys.length];
    if (ratings[key] === undefined) return key;
  }
  return current;
}

export function appendReviewToVisit(
  place: FirestorePlace,
  visitId: string,
  review: Review,
): FirestorePlace {
  const selectedVisit = place.visits.find((visit) => visit.id === visitId);
  if (!selectedVisit) throw new Error('Visit no longer exists.');
  if (selectedVisit.reviews.some(({ reviewerId }) => reviewerId === review.reviewerId)) {
    throw new Error(`${review.reviewerName} already reviewed this visit.`);
  }

  return {
    ...place,
    visits: place.visits.map((visit) => visit.id === visitId
      ? { ...visit, reviews: [...visit.reviews, review] }
      : visit),
  };
}

export type PersistPlace = (
  candidate: FirestorePlace,
  expectedUpdatedAt: string | undefined,
) => Promise<FirestorePlace>;

export async function saveReviewToVisit(
  place: FirestorePlace,
  visitId: string,
  review: Review,
  persist: PersistPlace,
): Promise<FirestorePlace> {
  return persist(appendReviewToVisit(place, visitId, review), place.updatedAt);
}
