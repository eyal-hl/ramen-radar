import type { FirestorePlace } from './firestore-model';
import { aggregateVisit } from './ratings';

export interface JournalEntry {
  placeId: string;
  placeName: string;
  city: string;
  coverImage: FirestorePlace['coverImage'];
  visitId: string;
  date: string;
  notes?: string;
  dishSummary: string;
  reviewerNames: string[];
  reviewCount: number;
  score: number | null;
}

function summarizeDishes(names: string[]): string {
  if (names.length < 2) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names.at(-1)}`;
}

export function toJournalEntries(places: FirestorePlace[]): JournalEntry[] {
  return places
    .flatMap((place) => place.visits.map((visit) => ({
      placeId: place.id,
      placeName: place.name,
      city: place.location.city,
      coverImage: place.coverImage,
      visitId: visit.id,
      date: visit.date,
      ...(visit.notes ? { notes: visit.notes } : {}),
      dishSummary: summarizeDishes(visit.dishes.map(({ name }) => name)),
      reviewerNames: visit.reviews.map(({ reviewerName }) => reviewerName),
      reviewCount: visit.reviews.length,
      score: aggregateVisit(visit).overall,
    })))
    .sort((a, b) => b.date.localeCompare(a.date)
      || a.placeName.localeCompare(b.placeName)
      || a.visitId.localeCompare(b.visitId));
}
