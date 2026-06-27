# Ramen Radar Design

## Purpose

Ramen Radar is a mobile-friendly, English-language directory and ranking site for ramen restaurants in Givatayim and the wider Tel Aviv area. It is published as a static GitHub Pages site. Restaurant data is maintained directly as JSON in the repository, allowing either a person or an automation such as OpenClaw to add and update places without using a database or admin interface.

## Architecture

The site uses Astro as a static-site generator. At build time it discovers every restaurant JSON document, validates it, calculates derived ranking data, and generates the directory and restaurant detail pages. A GitHub Actions workflow builds and deploys the output to GitHub Pages after pushes to the default branch.

Each restaurant is isolated in `src/data/places/<place-id>.json`. Stable string IDs identify places, reviewers, and visits. Images live under `src/assets/places/<place-id>/` and are referenced by repository-relative names from the JSON. Astro processes local images at build time. No manually maintained restaurant index, backend, authentication, or runtime API is required.

Malformed data must fail the build with an error that identifies the affected file and field. Missing optional ratings or metadata remain absent; they are never interpreted as zero.

## Data Model

A place document contains:

- Stable ID, display name, optional alternate name, description, and visit status (`want-to-visit`, `visited`, or `unavailable`).
- Address, city, latitude, longitude, and external map URL.
- Website, menu, reservation, phone, opening-hours note, price range, and currencies where available.
- Ramen styles, dietary options, and free-form discovery tags.
- Cover image and optional gallery images, each with required accessible alt text.
- Zero or more visits.

A visit contains a stable ID, date, optional visit-level notes and photos, ordered dishes, and one or more reviewer entries. Each reviewer entry contains a stable reviewer ID, display name, optional notes, and any subset of the global rating categories.

The initial categories are broth, noodles, toppings, egg, portion, value, service, atmosphere, and `wouldReturn`. Scores range from 1 through 10. Categories are centralized in application configuration so labels, inclusion, and weighting can be changed later without migrating the rendering components. `wouldReturn` is displayed alongside the categories and included in the default aggregate like other numeric ratings.

The example dataset must demonstrate a fictional place with multiple reviewers, multiple visits, dishes, local images, complete and partial ratings, and useful metadata. Its fictional nature must be unmistakable.

## Ranking Rules

Calculations use only ratings that exist:

1. A reviewer's visit score is the arithmetic mean of that reviewer's submitted category scores.
2. A visit score is the arithmetic mean of reviewer visit scores, giving each reviewer equal influence even if one omitted a category.
3. A restaurant score is the arithmetic mean of all reviewer visit scores across all visits, so every submitted reviewer experience has equal influence.
4. A restaurant category score is the arithmetic mean of all submitted scores for that category across visits and reviewers.

Scores are calculated with full precision and displayed to one decimal place. Places without any ratings are shown as "Not rated yet" and never mixed into ranked ordering as zero. Repeat visits remain independent historical records.

## User Experience

The visual direction is warm, editorial, and food-focused rather than dashboard-like. The interface is responsive and optimized for phone use, with accessible contrast, keyboard navigation, semantic markup, visible focus states, and reduced-motion support.

The home page includes:

- A compact hero with the collection summary.
- Search across name, city, ramen style, and tags.
- Filters for visit status, city, ramen style, dietary options, price range, and minimum rating.
- Sorting by rating, most recently visited, name, and recently added.
- Separate, clearly labeled states for visited and want-to-visit places.
- Restaurant cards showing imagery, location, status, tags, price, score, visit count, and latest visit when applicable.
- A useful empty state when filters produce no matches.

Each restaurant detail page includes:

- Cover image, identity, status, address, map link, contact/menu links, tags, styles, dietary information, and gallery.
- Overall score and category averages.
- A reviewer breakdown so individual scores are inspectable rather than hidden behind averages.
- Reverse-chronological visit history with date, dishes, notes, photos, and each person's submitted ratings.
- A clear unrated state for planned places.

Filtering and sorting run in the browser against the build-generated dataset. Core restaurant links and detail content remain usable without client-side JavaScript.

## Components and Boundaries

- The content schema owns validation and inferred TypeScript types.
- The scoring module is a pure, independently tested transformation from visits to aggregates.
- Data-loading utilities own collection discovery and view-model creation.
- Shared presentational components render score badges, category bars, status chips, image galleries, metadata, restaurant cards, and visit reviews.
- Page routes compose these units but do not duplicate scoring or validation logic.
- A small client-side directory controller owns search, filter, and sort state without becoming the source of restaurant data.

## Error Handling

Build validation rejects duplicate IDs, invalid score ranges, invalid dates, visited places without visits, broken local image references, missing image alt text, and structurally invalid JSON. External URLs are validated syntactically but are not required to be reachable during a build. The UI handles absent optional fields, empty galleries, partial ratings, and places with no visits without broken placeholders.

## Testing and Verification

- Unit tests cover score aggregation, partial ratings, multiple reviewers, repeat visits, and unrated places.
- Schema tests cover valid example data and representative invalid documents.
- Component/page checks verify generated directory and detail pages contain expected content.
- The production build is the deployment gate and must work with the GitHub Pages repository subpath.
- Automated accessibility checks cover the main directory and example restaurant page.
- A final responsive browser pass verifies filtering, sorting, navigation, imagery, and layouts at phone and desktop widths.

## Repository Guidance

The README documents local setup, JSON fields, how to add a place or visit, image conventions, validation/build commands, and GitHub Pages deployment. A copyable JSON template is included separately from the fictional example. Generated output and dependencies are ignored. The implementation avoids secrets and remote services, so forks can deploy safely with standard GitHub Pages permissions.

## Scope Exclusions

The first version has no public submissions, accounts, CMS, database, comments, social features, live opening-hours integration, route planning, or automatic geolocation. These can be added later without changing the JSON-first ownership model, but they are not needed to deliver the requested site.
