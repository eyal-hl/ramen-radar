---
name: ramen-radar-maintainer
description: Use when adding or updating Ramen Radar places, Google Maps links, visits, dishes, photos, reviewers, ratings, or availability in the eyal-hl/ramen-radar repository.
metadata: {"openclaw":{"emoji":"🍜","requires":{"bins":["git","node","npm"],"env":["RAMEN_RADAR_REPO"]}}}
---

# Maintain Ramen Radar

Maintain the JSON-backed Ramen Radar site from conversational requests. Work only in the repository identified by `RAMEN_RADAR_REPO`.

## Safety gate

Before changing anything:

1. Resolve `RAMEN_RADAR_REPO` and confirm it is a Git worktree whose `origin` is `https://github.com/eyal-hl/ramen-radar.git` or the equivalent SSH URL.
2. Require branch `master` and a clean `git status --porcelain`. If the tree is dirty, stop and report the paths; never overwrite or stash unknown work.
3. Run `git pull --ff-only origin master`. Stop on conflicts, divergence, network failure, or authentication failure.
4. Read `README.md`, `src/data/place-template.json.example`, `src/domain/place-schema.ts`, and the target place JSON when one exists.

Do not modify application code, dependencies, workflows, schemas, scoring rules, or layouts. Those are software-development requests, not data maintenance.

## Resolve the request

Supported operations:

- Add a planned place from a Google Maps URL or supplied facts.
- Correct factual place metadata.
- Append a first or repeat visit.
- Add dishes, shared notes, reviewer notes, photos, and partial ratings.
- Mark a place unavailable.

Ask one concise question only when missing information materially changes stored data, such as an ambiguous venue, reviewer identity, visit date, dish identity, or rating ownership. Otherwise proceed.

## Add a planned place

1. Follow a supplied Maps redirect and verify the venue name, street address, city, latitude, and longitude. Preserve the original supplied URL as `location.mapUrl`. If identity or coordinates cannot be verified, ask rather than guess.
2. Create one file at `src/data/places/<place-id>.json`, following `src/data/place-template.json.example`.
3. Use a stable lowercase hyphenated ID, `status: "want-to-visit"`, and `visits: []`.
4. Do not invent ratings, ramen styles, dietary options, website links, opening hours, or other uncertain facts. Empty supported arrays and objects are preferable to guesses.
5. If no real image was supplied, use `../../assets/places/unvisited/placeholder.svg`. For a supplied image, store it under `src/assets/places/<place-id>/` with a useful filename and accessible alt text.

## Record a visit

1. Append a new visit; never replace or reorder historical visits merely because the place was revisited.
2. Give the visit a unique stable ID and store the actual date as `YYYY-MM-DD`.
3. On the first visit, change the place status to `visited`.
4. Keep each reviewer separate. Reuse their stable `reviewerId` on later visits.
5. Ratings are integer values from 1 through 10. Supported keys are `broth`, `noodles`, `toppings`, `egg`, `portion`, `value`, `service`, `atmosphere`, and `wouldReturn`.
6. Partial ratings are valid. Omit unscored categories; never store them as zero.
7. Attach notes to the visit or reviewer that supplied them. Store photos under the place asset folder with alt text.

## Validate and publish

Review the diff and confirm only intended place data and assets changed. Then run, in order:

```text
npm test
npm run check
npm run build
```

If any command fails, do not commit or push. Leave the files for inspection and report the concise error and changed paths.

When all commands pass:

1. Commit only the intended data/assets with a narrow message such as `data: add <place>` or `data: record <place> visit`.
2. Push with `git push origin master`. Never force-push, reset history, bypass hooks, or weaken CI.
3. Report the operation, place, changed files, and commit hash. Say deployment was triggered, not that the live site changed.
4. If `gh` is available, inspect the workflow run. Claim deployment success only after the Pages workflow succeeds.

## Refuse unsafe shortcuts

- Never fabricate venue facts or scores.
- Never erase earlier visits to simplify the JSON.
- Never mix ratings between people.
- Never commit unrelated dirty files.
- Never push after failed validation.
- Never expose GitHub tokens, credentials, environment values, or private file contents in chat or logs.
