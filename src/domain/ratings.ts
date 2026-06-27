import { ratingKeys, type Place, type RatingKey, type Review, type Visit } from './place-schema';

export const RATING_CATEGORIES: ReadonlyArray<{ key: RatingKey; label: string }> = [
  { key: 'broth', label: 'Broth' },
  { key: 'noodles', label: 'Noodles' },
  { key: 'toppings', label: 'Toppings' },
  { key: 'egg', label: 'Egg' },
  { key: 'portion', label: 'Portion' },
  { key: 'value', label: 'Value' },
  { key: 'service', label: 'Service' },
  { key: 'atmosphere', label: 'Atmosphere' },
  { key: 'wouldReturn', label: 'Would return' },
];

export interface ReviewScore {
  reviewerId: string;
  reviewerName: string;
  score: number;
}

export interface RatingAggregate {
  overall: number | null;
  categories: Record<RatingKey, number | null>;
  reviewerScores: ReviewScore[];
  reviewCount: number;
  ratedVisitCount: number;
}

export function mean(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function scoreReview(review: Review): number | null {
  const values = ratingKeys.flatMap((key) => review.ratings[key] ?? []);
  return mean(values);
}

export function aggregateVisit(visit: Visit): RatingAggregate {
  const reviewerScores = visit.reviews.flatMap((review) => {
    const score = scoreReview(review);
    return score === null ? [] : [{ reviewerId: review.reviewerId, reviewerName: review.reviewerName, score }];
  });
  const categories = Object.fromEntries(ratingKeys.map((key) => [
    key,
    mean(visit.reviews.flatMap((review) => review.ratings[key] ?? [])),
  ])) as Record<RatingKey, number | null>;

  return {
    overall: mean(reviewerScores.map(({ score }) => score)),
    categories,
    reviewerScores,
    reviewCount: reviewerScores.length,
    ratedVisitCount: reviewerScores.length > 0 ? 1 : 0,
  };
}

export function aggregatePlace(place: Place): RatingAggregate {
  const visits = place.visits.map(aggregateVisit);
  const reviewerScores = visits.flatMap((visit) => visit.reviewerScores);
  const categories = Object.fromEntries(ratingKeys.map((key) => [
    key,
    mean(place.visits.flatMap((visit) => visit.reviews.flatMap((review) => review.ratings[key] ?? []))),
  ])) as Record<RatingKey, number | null>;

  return {
    overall: mean(reviewerScores.map(({ score }) => score)),
    categories,
    reviewerScores,
    reviewCount: reviewerScores.length,
    ratedVisitCount: visits.filter(({ ratedVisitCount }) => ratedVisitCount > 0).length,
  };
}

export function formatScore(score: number | null): string {
  return score === null ? 'Not rated yet' : score.toFixed(1);
}

