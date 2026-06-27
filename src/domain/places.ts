import type { Place } from './place-schema';
import { aggregatePlace } from './ratings';

export type PlaceStatus = Place['status'];
export type SortMode = 'rating' | 'recent-visit' | 'name' | 'recently-added';

export interface PlaceCard {
  id: string;
  name: string;
  description: string;
  fictional: boolean;
  location: Place['location'];
  status: PlaceStatus;
  priceRange: Place['priceRange'];
  tags: string[];
  ramenStyles: string[];
  dietaryOptions: string[];
  coverImage: Place['coverImage'];
  score: number | null;
  visitCount: number;
  latestVisit: string | null;
  addedAt: string;
  searchText: string;
}

export function toPlaceCard(place: Place): PlaceCard {
  const dates = place.visits.map(({ date }) => date).sort((a, b) => b.localeCompare(a));
  const searchText = [
    place.name,
    place.location.city,
    ...place.ramenStyles,
    ...place.dietaryOptions,
    ...place.tags,
    place.description,
  ].join(' ').toLocaleLowerCase();

  return {
    id: place.id,
    name: place.name,
    description: place.description,
    fictional: place.fictional,
    location: place.location,
    status: place.status,
    priceRange: place.priceRange,
    tags: place.tags,
    ramenStyles: place.ramenStyles,
    dietaryOptions: place.dietaryOptions,
    coverImage: place.coverImage,
    score: aggregatePlace(place).overall,
    visitCount: place.visits.length,
    latestVisit: dates[0] ?? null,
    addedAt: place.addedAt,
    searchText,
  };
}

export function sortPlaceCards(cards: PlaceCard[], mode: SortMode): PlaceCard[] {
  return [...cards].sort((a, b) => {
    if (mode === 'rating') {
      if (a.score === null && b.score !== null) return 1;
      if (a.score !== null && b.score === null) return -1;
      if (a.score !== null && b.score !== null && a.score !== b.score) return b.score - a.score;
    }
    if (mode === 'recent-visit' && a.latestVisit !== b.latestVisit) {
      return (b.latestVisit ?? '').localeCompare(a.latestVisit ?? '');
    }
    if (mode === 'recently-added' && a.addedAt !== b.addedAt) {
      return b.addedAt.localeCompare(a.addedAt);
    }
    return a.name.localeCompare(b.name);
  });
}
