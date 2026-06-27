# Ramen Radar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished Astro site that ranks JSON-defined ramen places, supports repeated visits and multiple reviewers, and deploys safely to GitHub Pages.

**Architecture:** Astro content collections validate one JSON document per restaurant and generate a filterable directory plus static detail routes. Pure TypeScript scoring utilities derive all averages, while small Astro components own presentation and a focused browser script owns directory filtering. Local images are imported through Astro's asset pipeline and GitHub Actions publishes the static build.

**Tech Stack:** Astro 5, TypeScript, Zod through Astro content schemas, Vitest, Playwright, axe-core, CSS, GitHub Actions

## Global Constraints

- English-only, mobile-first, static GitHub Pages site with no backend, database, accounts, or runtime API.
- Restaurant content is maintained as one JSON file per place under `src/data/places/`.
- Scores are integers from 1 through 10; missing scores do not count as zero.
- Stable string IDs identify places, visits, and reviewers.
- Local images require accessible alt text and are processed at build time.
- Places support `want-to-visit`, `visited`, and `unavailable` states.
- Core detail pages and links remain usable without client-side JavaScript.
- The production build supports an arbitrary GitHub Pages repository subpath.

---

## Planned File Structure

- `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`: project, build, and test configuration.
- `src/content.config.ts`: place collection schema and cross-field validation.
- `src/data/places/moon-bowl-ramen.json`: fictional example with two visits and multiple reviewers.
- `src/data/place-template.json.example`: copyable empty-place template excluded from the collection.
- `src/assets/places/moon-bowl-ramen/*`: clearly illustrative local example imagery.
- `src/domain/ratings.ts`: category definitions and pure aggregate calculations.
- `src/domain/places.ts`: place view-model construction and sorting helpers.
- `src/domain/*.test.ts`: domain and schema behavior tests.
- `src/layouts/BaseLayout.astro`: document shell, metadata, navigation, and global asset hooks.
- `src/components/*`: focused cards, filters, scores, gallery, metadata, and visit components.
- `src/pages/index.astro`, `src/pages/places/[id].astro`: generated directory and detail routes.
- `src/scripts/directory.ts`: browser-side search, filter, sort, and empty-state behavior.
- `src/styles/global.css`: tokens, responsive layout, accessibility, and component styling.
- `tests/site.spec.ts`: production-site interaction, accessibility, and responsive smoke tests.
- `.github/workflows/deploy.yml`: GitHub Pages build/deploy workflow.
- `.gitignore`, `README.md`: repository hygiene and editing/deployment documentation.

### Task 1: Scaffold the Tested Astro Application

**Files:**
- Create: `package.json`
- Create: `astro.config.mjs`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/pages/index.astro`
- Create: `.gitignore`

**Interfaces:**
- Produces: `npm run dev`, `npm run test`, `npm run build`, and `npm run check` commands used by every later task.

- [ ] **Step 1: Define project commands and dependencies**

Create `package.json` with ESM enabled and scripts `dev: astro dev`, `build: astro build`, `preview: astro preview`, `check: astro check`, `test: vitest run`, and `test:e2e: playwright test`. Add Astro, TypeScript, Vitest, Playwright, `@axe-core/playwright`, and `@astrojs/check` at current compatible stable versions using `npm install`.

- [ ] **Step 2: Configure repository-aware GitHub Pages paths**

Create `astro.config.mjs` so `site` uses `SITE_URL` when provided and `base` uses `BASE_PATH`, defaulting both to local-safe values:

```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: process.env.SITE_URL ?? 'http://localhost:4321',
  base: process.env.BASE_PATH ?? '/',
  output: 'static',
});
```

- [ ] **Step 3: Add strict TypeScript and a buildable smoke page**

Extend `astro/tsconfigs/strict`, configure Vitest for Node, and render an index page containing `Ramen Radar`. Ignore `node_modules/`, `dist/`, `.astro/`, `playwright-report/`, and `test-results/`.

- [ ] **Step 4: Verify the scaffold**

Run `npm run check`, `npm run test -- --passWithNoTests`, and `npm run build`. Expect all three to exit 0 and `dist/index.html` to exist.

- [ ] **Step 5: Commit**

```powershell
git add package.json package-lock.json astro.config.mjs tsconfig.json vitest.config.ts src/pages/index.astro .gitignore
git commit -m "chore: scaffold Astro site"
```

### Task 2: Define and Validate JSON Place Content

**Files:**
- Create: `src/content.config.ts`
- Create: `src/data/places/moon-bowl-ramen.json`
- Create: `src/data/place-template.json.example`
- Create: `src/assets/places/moon-bowl-ramen/cover.svg`
- Create: `src/assets/places/moon-bowl-ramen/shop.svg`
- Create: `src/domain/content.test.ts`

**Interfaces:**
- Produces: Astro collection `places`; types `Place` and `PlaceEntry`; image objects shaped as `{ src: ImageMetadata, alt: string, caption?: string }`.
- Consumes: Astro content loader and Zod schema APIs.

- [ ] **Step 1: Write schema tests first**

Test a minimal planned place, the full example, and rejection of scores outside 1–10, duplicate visit IDs, duplicate reviewer IDs within a visit, visited places with no visits, and image entries without alt text. Tests should call `createPlaceSchema(z.string()).parse()` and expect `ZodError` for invalid fixtures.

- [ ] **Step 2: Verify schema tests fail**

Run `npm test -- src/domain/content.test.ts`. Expect failure because `placeSchema` does not exist.

- [ ] **Step 3: Implement the collection schema**

Define reusable schemas for ratings, images, location, links, dishes, reviews, visits, and places. Use `.superRefine()` for ID uniqueness and the visited/visits invariant. Export a schema factory so unit tests can validate raw string paths while Astro supplies its image transform:

```ts
const score = z.number().int().min(1).max(10);
export const createPlaceSchema = (imageValue: z.ZodTypeAny) => {
const imageSchema = z.object({
  src: imageValue,
  alt: z.string().min(1),
  caption: z.string().min(1).optional(),
});
const ratingsSchema = z.object({
  broth: score.optional(), noodles: score.optional(), toppings: score.optional(),
  egg: score.optional(), portion: score.optional(), value: score.optional(),
  service: score.optional(), atmosphere: score.optional(), wouldReturn: score.optional(),
});

return z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  fictional: z.boolean().default(false),
  name: z.string().min(1),
  alternateName: z.string().min(1).optional(),
  description: z.string().min(1),
  status: z.enum(['want-to-visit', 'visited', 'unavailable']),
  addedAt: z.coerce.date(),
  location: z.object({
    address: z.string().min(1), city: z.string().min(1),
    latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180),
    mapUrl: z.string().url(),
  }),
  links: z.object({
    website: z.string().url().optional(), menu: z.string().url().optional(),
    reservations: z.string().url().optional(), phone: z.string().min(1).optional(),
  }).default({}),
  openingHoursNote: z.string().optional(),
  priceRange: z.enum(['$', '$$', '$$$', '$$$$']),
  currency: z.string().length(3).default('ILS'),
  ramenStyles: z.array(z.string().min(1)).default([]),
  dietaryOptions: z.array(z.string().min(1)).default([]),
  tags: z.array(z.string().min(1)).default([]),
  coverImage: imageSchema,
  gallery: z.array(imageSchema).default([]),
  visits: z.array(z.object({
    id: z.string().min(1), date: z.coerce.date(), notes: z.string().optional(),
    photos: z.array(imageSchema).default([]),
    dishes: z.array(z.object({ name: z.string().min(1), notes: z.string().optional() })).default([]),
    reviews: z.array(z.object({
      reviewerId: z.string().min(1), reviewerName: z.string().min(1),
      notes: z.string().optional(), ratings: ratingsSchema,
    })).min(1),
  })).default([]),
}).superRefine(validatePlace);
};
export type Place = z.infer<ReturnType<typeof createPlaceSchema>>;
export type PlaceEntry = CollectionEntry<'places'>;
```

Configure `glob({ pattern: '**/*.json', base: './src/data/places' })` and `schema: ({ image }) => createPlaceSchema(image())` for local assets.

- [ ] **Step 4: Add the fictional example and template**

Create `moon-bowl-ramen.json` with `fictional: true`, Givatayim coordinates, links, tags, styles, dietary options, two dated visits, at least two reviewers, full and partial ratings, dishes, notes, cover/gallery images, and explicit copy saying the venue is fictional. Add a zero-visit template showing all supported optional fields.

- [ ] **Step 5: Add original illustrative image assets**

Create two lightweight SVG illustrations labeled as fictional example artwork, with warm colors and no copied logos or photography. Reference them through the JSON image fields with descriptive alt text.

- [ ] **Step 6: Run validation gates**

Run `npm test -- src/domain/content.test.ts`, `npm run check`, and `npm run build`. Expect all to pass and Astro to load exactly one place.

- [ ] **Step 7: Commit**

```powershell
git add src/content.config.ts src/data src/assets/places src/domain/content.test.ts
git commit -m "feat: add validated restaurant content model"
```

### Task 3: Implement Rating Aggregation and Place View Models

**Files:**
- Create: `src/domain/ratings.ts`
- Create: `src/domain/ratings.test.ts`
- Create: `src/domain/places.ts`
- Create: `src/domain/places.test.ts`

**Interfaces:**
- Produces: `RATING_CATEGORIES`, `mean(values): number | null`, `scoreReview(review)`, `aggregateVisit(visit)`, `aggregatePlace(place)`, `toPlaceCard(entry)`, and `sortPlaceCards(cards, mode)`.
- Consumes: `Place`, `Visit`, `Review`, and collection entries from Task 2.

- [ ] **Step 1: Write failing aggregation tests**

Cover one-decimal display rounding without losing internal precision, omitted categories, equal reviewer weighting, repeated visits, category averages, and a no-ratings result of `null`. Assert that a reviewer with two ratings has equal restaurant influence to a reviewer with nine ratings.

- [ ] **Step 2: Verify aggregation tests fail**

Run `npm test -- src/domain/ratings.test.ts`. Expect import failure for `ratings.ts`.

- [ ] **Step 3: Implement pure scoring functions**

Represent categories as readonly `{ key, label }` objects. Return aggregate objects containing `overall`, `categories`, `reviewerScores`, `reviewCount`, and `ratedVisitCount`. Never coerce absent values to zero and never round stored calculations.

- [ ] **Step 4: Write failing place view-model tests**

Verify rated-first score sorting, alphabetical tie-breaking, newest visit extraction, search text normalization, and unrated cards remaining present.

- [ ] **Step 5: Implement place view models and sorting**

Create serializable card models containing route ID, name, image, city, status, price, tags, styles, dietary options, score, visit count, latest visit, and normalized searchable text.

- [ ] **Step 6: Verify domain behavior**

Run `npm test -- src/domain` and `npm run check`. Expect all tests and type checks to pass.

- [ ] **Step 7: Commit**

```powershell
git add src/domain
git commit -m "feat: calculate ramen ratings and rankings"
```

### Task 4: Build the Directory and Responsive Visual System

**Files:**
- Create: `src/layouts/BaseLayout.astro`
- Create: `src/components/ScoreBadge.astro`
- Create: `src/components/StatusChip.astro`
- Create: `src/components/PlaceCard.astro`
- Create: `src/components/DirectoryFilters.astro`
- Create: `src/scripts/directory.ts`
- Create: `src/styles/global.css`
- Modify: `src/pages/index.astro`
- Create: `src/domain/directory.test.ts`

**Interfaces:**
- Produces: accessible directory markup whose cards expose `data-*` fields and whose controls use `data-directory-*` hooks.
- Consumes: `toPlaceCard()`, `sortPlaceCards()`, collection data, and Astro's `Image` component.

- [ ] **Step 1: Write failing filter predicate tests**

Extract and test `matchesDirectoryFilters(card, filters)` for case-insensitive search, status, city, style, diet, price, minimum score, combined filters, and unrated behavior.

- [ ] **Step 2: Verify filter tests fail**

Run `npm test -- src/domain/directory.test.ts`. Expect the missing predicate import to fail.

- [ ] **Step 3: Implement the directory predicate and browser controller**

Keep the predicate pure. The browser controller reads controls, toggles card visibility, reorders cards for the chosen sort, updates a result count, and shows an empty state. Preserve query state in the URL using `history.replaceState`.

- [ ] **Step 4: Build the semantic page and components**

Render the collection summary, search, all specified filters, sorting, cards, visited/wish-list status, score/visit metadata, and no-results copy. Cards remain normal links when JavaScript is unavailable.

- [ ] **Step 5: Add the warm editorial visual system**

Define CSS tokens for ink, cream, chili, broth, jade, spacing, radii, shadows, and type scale. Implement phone-first cards and controls, a wider responsive grid, visible focus styles, `prefers-reduced-motion`, and high-contrast status treatments.

- [ ] **Step 6: Verify directory output**

Run `npm test`, `npm run check`, and `npm run build`. Inspect `dist/index.html` for Moon Bowl, filter labels, a detail-page link, and the fictional marker.

- [ ] **Step 7: Commit**

```powershell
git add src/layouts src/components src/scripts src/styles src/pages/index.astro src/domain/directory.test.ts
git commit -m "feat: build filterable ramen directory"
```

### Task 5: Generate Complete Restaurant Detail Pages

**Files:**
- Create: `src/components/CategoryScores.astro`
- Create: `src/components/PlaceMeta.astro`
- Create: `src/components/ImageGallery.astro`
- Create: `src/components/ReviewRatings.astro`
- Create: `src/components/VisitCard.astro`
- Create: `src/pages/places/[id].astro`
- Create: `src/domain/rendering.test.ts`

**Interfaces:**
- Produces: one static `/places/<id>/` route per JSON document.
- Consumes: `aggregatePlace()`, rating category metadata, Astro content entries, and local image metadata.

- [ ] **Step 1: Add a failing generated-route test**

Build the project from a Vitest fixture and assert that the example page contains overall and category scores, both visits in reverse chronological order, both reviewer names, dishes, notes, gallery alt text, map/menu links, and a visible fictional notice.

- [ ] **Step 2: Verify the route test fails**

Run `npm test -- src/domain/rendering.test.ts`. Expect failure because the detail page is absent.

- [ ] **Step 3: Implement static routes and detail components**

Use `getStaticPaths()` to return every collection entry. Compose cover/identity, metadata/actions, aggregate score, category bars, reviewer visibility, gallery, and visit timeline. Render `Not rated yet` for a planned place and omit absent optional metadata cleanly.

- [ ] **Step 4: Verify detail generation**

Run `npm test -- src/domain/rendering.test.ts`, `npm run check`, and `npm run build`. Expect a generated `dist/places/moon-bowl-ramen/index.html` and passing assertions.

- [ ] **Step 5: Commit**

```powershell
git add src/components src/pages/places src/domain/rendering.test.ts
git commit -m "feat: add restaurant visit detail pages"
```

### Task 6: Add Browser, Accessibility, and Deployment Verification

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/site.spec.ts`
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Produces: `npm run test:e2e` and automatic Pages deployment.
- Consumes: the production build and preview server from prior tasks.

- [ ] **Step 1: Write end-to-end tests**

Test directory-to-detail navigation, search/filter no-results and recovery, sort behavior, query persistence, keyboard focus, phone viewport layout, and no serious/critical axe violations on both routes.

- [ ] **Step 2: Verify browser tests expose missing configuration**

Run `npm run test:e2e`. Expect failure until Playwright's `webServer` is configured.

- [ ] **Step 3: Configure production browser testing**

Set Playwright's web server to `npm run build && npm run preview -- --host 127.0.0.1`, base URL to `http://127.0.0.1:4321`, Chromium as the default project, screenshots on failure, and trace on first retry.

- [ ] **Step 4: Add secure GitHub Pages deployment**

Create a workflow triggered by pushes to `master` and manual dispatch. Grant only `contents: read`, `pages: write`, and `id-token: write`; use official checkout, setup-node, configure-pages, upload-pages-artifact, and deploy-pages actions. Derive `SITE_URL` and `BASE_PATH` from the Pages configuration and run `npm ci`, tests, check, and build before upload.

- [ ] **Step 5: Run all automated gates**

Run `npm test`, `npm run check`, `npm run build`, and `npm run test:e2e`. Expect all to exit 0 with no serious or critical accessibility violations.

- [ ] **Step 6: Commit**

```powershell
git add playwright.config.ts tests .github/workflows/deploy.yml
git commit -m "ci: verify and deploy Ramen Radar"
```

### Task 7: Document JSON Editing and Perform the Completion Audit

**Files:**
- Create: `README.md`
- Modify: any file found defective during the audit

**Interfaces:**
- Produces: a complete handoff for manual and OpenClaw JSON maintenance.
- Consumes: all actual commands, paths, and fields implemented in Tasks 1–6.

- [ ] **Step 1: Write the operator documentation**

Document prerequisites, install/dev/build/test commands, the file layout, every JSON field, rating rules, stable-ID conventions, adding a place, adding a repeat visit, adding a reviewer, adding images with alt text, copying the template, validation failures, GitHub Pages settings, and editing from GitHub mobile or OpenClaw through commits.

- [ ] **Step 2: Verify README commands literally**

From a clean install, run `npm ci`, `npm test`, `npm run check`, `npm run build`, and `npm run test:e2e`. Correct the README or implementation if any documented command differs.

- [ ] **Step 3: Audit every design requirement**

Check the design spec section by section against JSON, source, generated HTML, browser behavior, tests, workflow, and documentation. Explicitly verify multiple reviewers, multiple visits, partial ratings, averages and individual scores, images, map location, all statuses, filters/sorts, mobile behavior, fictional example data, repository subpath handling, and build-time validation.

- [ ] **Step 4: Inspect repository hygiene**

Run `git status --short`, `git diff --check`, and `git ls-files`. Confirm generated output, dependencies, reports, and scratch files are absent and no debug logging or secrets remain.

- [ ] **Step 5: Commit the completed handoff**

```powershell
git add README.md
git commit -m "docs: explain Ramen Radar maintenance"
```

- [ ] **Step 6: Record final evidence**

Run `git status --short`, `npm test`, `npm run check`, `npm run build`, and `npm run test:e2e` once more. Expect a clean worktree and every gate to pass before claiming completion.
