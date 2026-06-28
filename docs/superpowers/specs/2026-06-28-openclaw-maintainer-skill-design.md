# OpenClaw Ramen Radar Maintainer Skill Design

## Purpose

Create an AgentSkills-compatible OpenClaw skill that lets the owner maintain Ramen Radar conversationally from a phone or computer. The skill translates requests, Google Maps links, ratings, visit notes, and attached photos into validated repository changes and deploys them through the existing `master` GitHub Pages workflow.

## Packaging and Installation

The repository contains `openclaw/ramen-radar-maintainer/SKILL.md`. This is the complete portable skill folder and can be installed globally with OpenClaw's local skill installer. A global install makes it available to any local OpenClaw agent, while the repository remains the versioned source of truth.

The OpenClaw host must have Node.js 22 or newer, Git, GitHub push authentication for `eyal-hl/ramen-radar`, a local clone of the repository, and npm dependencies installed. The skill reads the repository location from `RAMEN_RADAR_REPO`; this avoids hard-coding a machine-specific path.

## Supported Requests

The skill triggers for Ramen Radar maintenance, including:

- Adding a future place from a Google Maps link or supplied venue details.
- Correcting factual place metadata.
- Recording a first or repeat visit.
- Adding one or more reviewers and partial 1–10 ratings.
- Adding dishes, shared notes, personal notes, and attached photos.
- Changing a place to unavailable.

It does not modify application code, scoring rules, layouts, dependencies, workflows, or schemas. Those remain software-development tasks.

## Data Rules

The skill reads `README.md`, `src/data/place-template.json.example`, `src/domain/place-schema.ts`, and the target place JSON before editing. One file under `src/data/places/` owns each place. Stable place, visit, and reviewer IDs are never renamed casually.

New places use `want-to-visit`, an empty `visits` array, verified coordinates, the original Maps URL, and no invented ratings, ramen styles, dietary options, links, or other uncertain facts. When no real image is supplied, the shared unvisited placeholder is used. Missing required facts are requested from the user or left as supported empty fields; they are not guessed.

Visits are appended rather than replacing history. The first visit changes status to `visited`. Scores are integers from 1 through 10 and may be partial. Missing categories remain absent rather than zero. Photos are stored under `src/assets/places/<place-id>/` with useful filenames and accessible alt text.

## Repository Workflow

Before edits, the skill locates `RAMEN_RADAR_REPO`, confirms the remote repository, switches to `master`, requires a clean worktree, and runs `git pull --ff-only origin master`. A dirty worktree, unexpected remote, pull conflict, authentication problem, or concurrent change stops the operation with a clear report.

After editing, it reviews the diff and runs:

1. `npm test`
2. `npm run check`
3. `npm run build`

Only a fully passing change is committed with a narrow message and pushed to `origin master`. Validation failure leaves changes uncommitted and reports the relevant error. The skill never force-pushes, resets, deletes history, bypasses CI, or broadens credentials.

## Confirmation and Reporting

For a sufficiently specified request, the skill acts without repetitive confirmation. It asks one concise question only when an answer materially changes stored data—for example, reviewer identity, visit date, dish identity, or ambiguous venue resolution.

After success, it reports the place, operation, affected file, commit hash, and that deployment has been triggered. If available, it may report the GitHub Actions URL, but it does not claim the live site updated until deployment succeeds.

## Verification Scenarios

The skill is checked against representative requests:

- A Maps-only request must create a planned place without fabricated ratings or visits.
- A second visit must append history and retain the first visit unchanged.
- Two reviewers with partial scores must remain separate and preserve missing categories.
- A dirty worktree or failed schema check must prevent commit and push.
- A request to change site code must be refused as outside this skill's scope.

## Documentation

The final handoff includes the skill file plus concise setup commands for cloning the repository, installing dependencies, configuring GitHub authentication, setting `RAMEN_RADAR_REPO`, installing the skill globally, verifying discovery, and testing a harmless read-only request.
