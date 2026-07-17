# Ramen Radar

An Astro directory and ranking site for ramen around Givatayim and Tel Aviv. GitHub Pages hosts the static application, while Cloud Firestore supplies live place, visit, and review data. Approved Google accounts edit the directory at `/manage/`.

## Architecture

- Public reads come from `places/{placeId}` in Firestore.
- Google Authentication identifies editors.
- A user may edit only when `editors/{uid}` exists. Browser clients cannot modify the editor allowlist.
- Security Rules hide archived places and deny all unapproved writes.
- Repository images live under `public/images/places/`; HTTPS image URLs are also accepted. Optional Cloudinary uploads let approved editors add JPEG, PNG, and WebP photos directly from a phone or computer, automatically compressing photos over 5 MB before upload.
- Public detail URLs use `/place/?id=<place-id>` so newly added places work immediately on GitHub Pages.
- Firestore is the production source of truth. Legacy JSON place data and the temporary importer have been removed after migration.

## Firebase setup

The Spark plan is sufficient; no billing account or Firebase Storage bucket is required.

1. Create a Firebase project and one Firestore database in production mode.
2. Enable **Authentication → Sign-in method → Google**.
3. Register a Web App and copy its public configuration.
4. Add the GitHub Pages hostname to **Authentication → Settings → Authorized domains**.
5. Copy `.env.example` to `.env` and fill in the public Web App values.
6. Authenticate the Firebase CLI and deploy the rules:

```powershell
npx firebase-tools@15.22.4 login
npx firebase-tools@15.22.4 use <project-id>
npx firebase-tools@15.22.4 deploy --only firestore:rules,firestore:indexes
```

For GitHub Pages, create these repository variables under **Settings → Secrets and variables → Actions → Variables**:

- `PUBLIC_FIREBASE_API_KEY`
- `PUBLIC_FIREBASE_AUTH_DOMAIN`
- `PUBLIC_FIREBASE_PROJECT_ID`
- `PUBLIC_FIREBASE_APP_ID`
- `PUBLIC_FIREBASE_STORAGE_BUCKET`
- `PUBLIC_FIREBASE_MESSAGING_SENDER_ID`

Firebase’s Web API key is public configuration; authorization is enforced by Authentication and Firestore Security Rules. Never add a service-account key to this repository.

## Bootstrap the first editor and data

1. Deploy the site and open `/manage/`.
2. Sign in once with the owner’s Google account. The access-pending page displays its Firebase UID.
3. In Firebase Console, create `editors/<owner-uid>` with an optional `email` field.
4. Refresh `/manage/`. Use the editor for all place and review data.

To approve another editor, have them sign in once and then create `editors/<their-uid>` in Firebase Console. Removing that document revokes future writes.

## Editing content

The management page supports:

- Creating and editing places, location data, links, tags, and dietary options.
- Adding repeat visits, dishes, visit photos, reviewers, notes, and partial ratings.
- Repository image paths such as `/images/places/men-ten-ten/cover.jpg` and public HTTPS URLs.
- Archiving a place so it disappears publicly without permanent deletion.
- Optimistic concurrency: a stale editor must reload instead of overwriting a newer save.

Scores are integers from 1–10. Supported categories are `broth`, `noodles`, `toppings`, `egg`, `portion`, `value`, `service`, `atmosphere`, and `wouldReturn`. Missing categories are ignored rather than treated as zero.

## Repository images

Add images under `public/images/places/<place-id>/`, commit, and push them. After GitHub Pages deploys, reference them from the editor as:

```text
/images/places/<place-id>/<filename>
```

Every image requires meaningful alt text. External images must use HTTPS.

### Optional Cloudinary uploads

Cloudinary stores directly uploaded photos, so the Firebase project can remain on the Spark plan. The site only uses two public values: the cloud name and an unsigned upload-preset name. Never add a Cloudinary API key or API secret to this repository or to GitHub Actions variables.

1. In Cloudinary, create an **unsigned** upload preset, such as `ramen-radar-images-v1`.
2. Configure the preset to accept only `jpg`, `jpeg`, `png`, and `webp`, set a **5 MB** maximum file size, enable **disallow public ID**, and choose a preset-controlled folder such as `ramen-radar`.
3. Add these values locally in `.env` and as GitHub repository **Variables** for the Pages workflow:

```text
PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
PUBLIC_CLOUDINARY_UPLOAD_PRESET=ramen-radar-images-v1
```

The management editor then shows upload controls for a cover, gallery, and visit photos. Photos over 5 MB are resized and re-encoded locally before upload (source photos up to 25 MB). Uploading adds the returned HTTPS URL to the unsaved place draft; select **Save place** to publish the reference in Firestore. Removing a photo only removes its site reference, not the Cloudinary asset.

Unsigned preset names are visible to site visitors, so Cloudinary's format, size, and folder restrictions are essential. If uploads ever need stronger protection than those limits, use a server-side signed-upload endpoint rather than exposing a secret in the browser.

## Local development

Requires Node.js 22 or newer.

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Validation commands:

```powershell
npm test
npm run check
npm run build
```

Firestore Rules tests additionally require Java 21 or newer:

```powershell
npm run test:rules
```

The browser suite is currently not part of the GitHub Pages deployment gate because the app now reads live Firebase data.

## Deployment

Pushes to `master` run unit, type/content, and production build checks before GitHub Pages deployment. Firestore data changes are immediately visible on a new page load and do not require a site rebuild. Repository image changes still require the normal GitHub deployment.

To make GitHub Pages use Firebase, add the public Firebase values from `.env` as repository variables under **Settings → Secrets and variables → Actions → Variables**, then merge this branch to `master` and push. GitHub Actions injects those values during `npm run build` and publishes the generated `dist` folder through Pages.
