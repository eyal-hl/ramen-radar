import type { PlaceCard } from './places';

export interface DirectoryFilters {
  query: string;
  status: string;
  city: string;
  style: string;
  diet: string;
  price: string;
  minimumScore: number;
}

const includesNormalized = (values: string[], selected: string) =>
  values.some((value) => value.toLocaleLowerCase() === selected.toLocaleLowerCase());

export function matchesDirectoryFilters(card: PlaceCard, filters: DirectoryFilters): boolean {
  const query = filters.query.trim().toLocaleLowerCase();
  return (!query || card.searchText.includes(query))
    && (!filters.status || card.status === filters.status)
    && (!filters.city || card.location.city.toLocaleLowerCase() === filters.city.toLocaleLowerCase())
    && (!filters.style || includesNormalized(card.ramenStyles, filters.style))
    && (!filters.diet || includesNormalized(card.dietaryOptions, filters.diet))
    && (!filters.price || card.priceRange === filters.price)
    && (filters.minimumScore === 0 || (card.score !== null && card.score >= filters.minimumScore));
}
