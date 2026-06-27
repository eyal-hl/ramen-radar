import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { createPlaceSchema } from './domain/place-schema';

const places = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/data/places' }),
  schema: ({ image }) => createPlaceSchema(image()),
});

export const collections = { places };
export { createPlaceSchema } from './domain/place-schema';

