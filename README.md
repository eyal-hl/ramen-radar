# Ramen Radar

A JSON-driven ramen ranking site for Givatayim and the wider Tel Aviv area. It is an Astro static site designed for GitHub Pages: no database, login, admin panel, or server is required.

Restaurant facts, visits, photos, notes, and individual ratings all live in one JSON file per place. You can edit those files locally, in GitHub's mobile editor, or through an automation such as OpenClaw. Pushing a valid edit rebuilds the site automatically.

The home-page **List / Map** toggle shows the same filtered places geographically. The map loads Leaflet and OpenStreetMap tiles only after Map is selected; List remains the default and continues working if JavaScript or map tiles are unavailable. Every place therefore needs accurate `latitude` and `longitude` values. OpenStreetMap attribution remains visible on the map as required.

## Local development

Requires Node.js 22 or newer.

```powershell
npm install
npm run dev
```

Open `http://localhost:4321`. Before pushing a change, run:

```powershell
npm test
npm run check
npm run build
```

For browser and accessibility tests, install Chromium once and run the suite:

```powershell
npx playwright install chromium
npm run test:e2e
```

## Adding a place

1. Copy `src/data/place-template.json.example` to `src/data/places/<place-id>.json`.
2. Replace `place-id` with a permanent lowercase, hyphenated ID such as `men-ten-ten`. Do not change an ID after publishing; it is used in the place URL.
3. Create `src/assets/places/<place-id>/` and add a cover image.
4. Update `coverImage.src` relative to the JSON file, for example `../../assets/places/men-ten-ten/cover.jpg`.
5. Write useful `alt` text that describes each image. Image entries without alt text fail validation.
6. Keep `status` as `want-to-visit` and `visits` as an empty array until the first visit.
7. Run `npm run check` and `npm run build` before committing.

The fictional example at `src/data/places/moon-bowl-ramen.json` demonstrates all important fields, repeat visits, multiple reviewers, partial ratings, dishes, notes, and photos. Moon Bowl is deliberately and visibly not a real restaurant.

## Place JSON reference

Required top-level fields:

| Field | Meaning |
| --- | --- |
| `id` | Stable lowercase ID using letters, numbers, and hyphens. |
| `fictional` | `true` only for clearly fictional sample data. |
| `name` | Public restaurant name. |
| `description` | Short factual summary shown on cards and detail pages. |
| `status` | `want-to-visit`, `visited`, or `unavailable`. |
| `addedAt` | Date added in `YYYY-MM-DD` format. |
| `location` | Address, city, latitude, longitude, and a `mapUrl`. |
| `links` | Optional `website`, `menu`, `reservations`, and `phone`. Use `{}` when empty. |
| `priceRange` | `$`, `$$`, `$$$`, or `$$$$`. |
| `currency` | Three-letter code, normally `ILS`. |
| `ramenStyles` | Searchable styles such as `shoyu`, `miso`, or `tantanmen`. |
| `dietaryOptions` | Searchable phrases such as `vegan option`. |
| `tags` | Free-form discovery tags such as `late lunch` or `date-friendly`. |
| `coverImage` | Local `src`, required `alt`, and optional `caption`. |
| `gallery` | Additional image objects. Use `[]` when empty. |
| `visits` | Chronological records; the site displays them newest first. |

Optional place fields are `alternateName` and `openingHoursNote`.

## Recording a visit

Append a new object to the place's `visits` array. Never overwrite an earlier visit; repeat visits are independent history.

```json
{
  "id": "summer-return-2026",
  "date": "2026-07-14",
  "notes": "Optional notes shared by the whole table.",
  "photos": [],
  "dishes": [
    {
      "name": "Shoyu ramen",
      "notes": "Optional dish details"
    }
  ],
  "reviews": [
    {
      "reviewerId": "eyal",
      "reviewerName": "Eyal",
      "notes": "Optional personal notes.",
      "ratings": {
        "broth": 9,
        "noodles": 8,
        "wouldReturn": 9
      }
    }
  ]
}
```

Visit IDs must be unique within the place. Reviewer IDs must be unique within a visit. Reuse a person's reviewer ID on later visits so their history remains recognizable.

Every visit needs at least one reviewer object, but a reviewer may omit any category they did not judge. Missing scores are ignored—they never become zero.

## Rating categories

Every submitted score is an integer from 1 through 10:

- `broth`
- `noodles`
- `toppings`
- `egg`
- `portion`
- `value`
- `service`
- `atmosphere`
- `wouldReturn`

The site first averages the categories submitted by each reviewer. Restaurant and visit scores then give every rated reviewer experience equal weight, even when one person skipped categories. Category breakdowns average every submitted value for that category. Displayed scores are rounded to one decimal place; calculations keep full precision.

To change the available categories later, update `ratingKeys`, `ratingsSchema`, and `RATING_CATEGORIES` in `src/domain/place-schema.ts` and `src/domain/ratings.ts`, then adjust their tests.

## Images

Keep images with their place under `src/assets/places/<place-id>/`. JPEG, PNG, WebP, and SVG files are supported by Astro. Use descriptive filenames and avoid very large originals. Every reference has this shape:

```json
{
  "src": "../../assets/places/place-id/photo.jpg",
  "alt": "What is visibly important in the photo",
  "caption": "Optional visible caption"
}
```

Astro verifies references and processes local images during the build. Broken paths stop deployment instead of producing broken image placeholders.

## Editing from a phone or OpenClaw

The safest automated workflow is one small commit per place update:

1. Read the existing place JSON and this README.
2. Modify only that place's JSON and image folder.
3. Preserve stable place, visit, and reviewer IDs.
4. Append new visits; do not rewrite visit history unless correcting a fact.
5. Run `npm run check` and `npm test` when the environment supports Node.
6. Commit and push. GitHub Actions performs the full validation before deployment.

If OpenClaw cannot run the build, it can still create a branch or commit. The GitHub workflow will reject invalid JSON with a file and field-level schema error.

## GitHub Pages deployment

The workflow in `.github/workflows/deploy.yml` tests and publishes the site on every push to `master` and can also be run manually.

In the GitHub repository:

1. Open **Settings → Pages**.
2. Under **Build and deployment**, select **GitHub Actions** as the source.
3. Push to `master` or run **Test and deploy Ramen Radar** from the Actions tab.

The workflow calculates the repository subpath automatically, so a repository named `ramen-radar` is served correctly from `/ramen-radar/`. A user-site repository named `<owner>.github.io` is served from `/`.

## Project structure

```text
src/
  assets/places/       Local restaurant and visit images
  components/          Reusable Astro UI components
  data/places/         One validated JSON document per place
  domain/              Schemas, scoring, sorting, and filter logic
  pages/               Directory and generated place routes
  styles/              Responsive visual system
tests/                  Browser and accessibility checks
```
