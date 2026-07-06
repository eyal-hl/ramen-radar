import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

export default defineConfig({
  site: process.env.SITE_URL ?? 'http://localhost:4321',
  base: process.env.BASE_PATH ?? '/',
  output: 'static',
  integrations: [preact()],
});
