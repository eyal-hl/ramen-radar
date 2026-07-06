import { z } from 'zod';
import { createPlaceSchema } from './place-schema';

const repositoryImage = /^\/images\/places\/[a-zA-Z0-9._/-]+$/;
const legacyImage = /^\.\.\/\.\.\/assets\/places\/[a-zA-Z0-9._/-]+$/;

export const imageSourceSchema = z.string().trim().refine((value) => {
  if (repositoryImage.test(value) || legacyImage.test(value)) return true;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}, 'Use an HTTPS URL or a repository image path under /images/places/.');

const basePlaceSchema = createPlaceSchema(imageSourceSchema);
const metadataSchema = z.object({
  archived: z.boolean().default(false),
  updatedAt: z.string().datetime().optional(),
});

export const firestorePlaceSchema = z.intersection(basePlaceSchema, metadataSchema);

export type FirestorePlace = z.infer<typeof firestorePlaceSchema>;

export function parsePlaceDocument(value: unknown): FirestorePlace {
  return firestorePlaceSchema.parse(value);
}

function migrateImageSource(source: string): string {
  return source.startsWith('../../assets/places/')
    ? source.replace('../../assets/places/', '/images/places/')
    : source;
}

export function toFirestorePlace(place: FirestorePlace, updatedAt: string): FirestorePlace {
  return parsePlaceDocument({
    ...place,
    archived: place.archived ?? false,
    updatedAt,
    coverImage: { ...place.coverImage, src: migrateImageSource(place.coverImage.src) },
    gallery: place.gallery.map((image) => ({ ...image, src: migrateImageSource(image.src) })),
    visits: place.visits.map((visit) => ({
      ...visit,
      photos: visit.photos.map((image) => ({ ...image, src: migrateImageSource(image.src) })),
    })),
  });
}

export function publicPlaces(places: FirestorePlace[]): FirestorePlace[] {
  return places.filter(({ archived }) => !archived);
}

export function resolveImageSource(source: string, base: string): string {
  if (source.startsWith('https://')) return source;
  const normalizedBase = `/${base.split('/').filter(Boolean).join('/')}`;
  return `${normalizedBase === '/' ? '' : normalizedBase}${source}`;
}
