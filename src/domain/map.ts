import type { PlaceCard, PlaceStatus } from './places';
import { joinBase } from './urls';

export interface MapPlace {
  id: string;
  name: string;
  city: string;
  status: PlaceStatus;
  priceRange: string;
  score: number | null;
  latitude: number;
  longitude: number;
  detailUrl: string;
}

export function markerClassForStatus(status: PlaceStatus): string {
  return `map-marker--${status}`;
}

export function toMapPlace(place: PlaceCard, base: string): MapPlace {
  return {
    id: place.id,
    name: place.name,
    city: place.location.city,
    status: place.status,
    priceRange: place.priceRange,
    score: place.score,
    latitude: place.location.latitude,
    longitude: place.location.longitude,
    detailUrl: `${joinBase(base, 'place/')}?id=${encodeURIComponent(place.id)}`,
  };
}
