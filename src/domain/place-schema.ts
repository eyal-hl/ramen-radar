import { z } from 'zod';

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const score = z.number().int().min(1).max(10);

export const ratingKeys = [
  'broth', 'noodles', 'toppings', 'egg', 'portion',
  'value', 'service', 'atmosphere', 'wouldReturn',
] as const;

export const ratingsSchema = z.object({
  broth: score.optional(), noodles: score.optional(), toppings: score.optional(),
  egg: score.optional(), portion: score.optional(), value: score.optional(),
  service: score.optional(), atmosphere: score.optional(), wouldReturn: score.optional(),
});

export function createPlaceSchema(imageValue: z.ZodTypeAny) {
  const imageSchema = z.object({
    src: imageValue,
    alt: z.string().trim().min(1),
    caption: z.string().trim().min(1).optional(),
  });
  const reviewSchema = z.object({
    reviewerId: z.string().regex(idPattern),
    reviewerName: z.string().trim().min(1),
    notes: z.string().trim().min(1).optional(),
    ratings: ratingsSchema,
  });
  const visitSchema = z.object({
    id: z.string().regex(idPattern),
    date: z.string().regex(datePattern),
    notes: z.string().trim().min(1).optional(),
    photos: z.array(imageSchema).default([]),
    dishes: z.array(z.object({
      name: z.string().trim().min(1),
      notes: z.string().trim().min(1).optional(),
    })).default([]),
    reviews: z.array(reviewSchema).min(1),
  }).superRefine((visit, context) => {
    const reviewerIds = visit.reviews.map((review) => review.reviewerId);
    if (new Set(reviewerIds).size !== reviewerIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Reviewer IDs must be unique within a visit.',
        path: ['reviews'],
      });
    }
  });

  return z.object({
    id: z.string().regex(idPattern),
    fictional: z.boolean().default(false),
    name: z.string().trim().min(1),
    alternateName: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1),
    status: z.enum(['want-to-visit', 'visited', 'unavailable']),
    addedAt: z.string().regex(datePattern),
    location: z.object({
      address: z.string().trim().min(1), city: z.string().trim().min(1),
      latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180),
      mapUrl: z.string().url(),
    }),
    links: z.object({
      website: z.string().url().optional(), menu: z.string().url().optional(),
      reservations: z.string().url().optional(), phone: z.string().trim().min(1).optional(),
    }).default({}),
    openingHoursNote: z.string().trim().min(1).optional(),
    priceRange: z.enum(['$', '$$', '$$$', '$$$$']),
    currency: z.string().length(3).default('ILS'),
    ramenStyles: z.array(z.string().trim().min(1)).default([]),
    dietaryOptions: z.array(z.string().trim().min(1)).default([]),
    tags: z.array(z.string().trim().min(1)).default([]),
    coverImage: imageSchema,
    gallery: z.array(imageSchema).default([]),
    visits: z.array(visitSchema).default([]),
  }).superRefine((place, context) => {
    const visitIds = place.visits.map((visit) => visit.id);
    if (new Set(visitIds).size !== visitIds.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Visit IDs must be unique within a place.', path: ['visits'] });
    }
    if (place.status === 'visited' && place.visits.length === 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Visited places must contain at least one visit.', path: ['visits'] });
    }
  });
}

export type Place = z.infer<ReturnType<typeof createPlaceSchema>>;
export type Ratings = z.infer<typeof ratingsSchema>;
export type RatingKey = typeof ratingKeys[number];
export type Visit = Place['visits'][number];
export type Review = Visit['reviews'][number];
