---
name: ramen-radar-maintainer
description: Upload and publish repository-hosted images for the eyal-hl/ramen-radar site. Firestore place and review data is edited through the site's approved-user management page.
metadata: {"openclaw":{"emoji":"🍜","requires":{"bins":["git","node","npm"],"env":["RAMEN_RADAR_REPO"]}}}
---

# Maintain Ramen Radar images

Use this skill only for repository-hosted images. Places, visits, reviewers, ratings, and other live content belong in Firestore and must be edited through `/manage/` by an approved Google account.

## Safety gate

1. Resolve `RAMEN_RADAR_REPO` and verify its origin is `eyal-hl/ramen-radar`.
2. Require branch `master` and a clean worktree; never stash or overwrite unknown changes.
3. Run `git pull --ff-only origin master` and stop on any conflict or authentication problem.
4. Read `README.md` and inspect the target folder under `public/images/places/`.

Do not modify application code, Firebase configuration, Firestore data, rules, dependencies, workflows, or existing images unrelated to the request.

## Add an image

1. Confirm the target place ID and obtain useful alt text from the user when it is not obvious.
2. Store the file under `public/images/places/<place-id>/` with a lowercase descriptive filename.
3. Accept JPEG, PNG, WebP, or SVG. Avoid oversized originals and never invent or download an image the user did not provide or authorize.
4. The value to paste into `/manage/` is `/images/places/<place-id>/<filename>`.
5. Review the diff and run `npm test`, `npm run check`, and `npm run build`.
6. Commit only the intended image, push normally, and report the path and commit hash. Never force-push.

Explain that the image URL becomes available after the GitHub Pages workflow succeeds; the user must then save that path with appropriate alt text in `/manage/`.

## Security

- Never request, read, or expose Firebase service-account keys, GitHub tokens, or user credentials.
- Never upload private or sensitive imagery without explicit authorization.
- Never claim deployment success until the GitHub Pages workflow confirms it.
