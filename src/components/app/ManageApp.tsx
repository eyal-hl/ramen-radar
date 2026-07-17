import type { ComponentChildren } from 'preact';
import type { User } from 'firebase/auth';
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { parsePlaceDocument, type FirestorePlace } from '../../domain/firestore-model';
import { parseGoogleMapsUrl } from '../../domain/google-maps';
import {
  availableReviewers,
  createReview,
  knownReviewers,
  nextUnratedRatingKey,
  reviewerIdFromName,
  saveReviewToVisit,
  setReviewRating,
  type ReviewerIdentity,
} from '../../domain/review-composer';
import { RATING_CATEGORIES, formatScore, scoreReview } from '../../domain/ratings';
import { type RatingKey, type Review, type Visit } from '../../domain/place-schema';
import { readManageIntent } from '../../domain/urls';
import { observeUser, signInWithGoogle, signOutUser } from '../../firebase/auth';
import { isApprovedEditor, listEditorPlaces, savePlace } from '../../firebase/places';
import { LoadState } from './PlaceBits';

const today = () => new Date().toISOString().slice(0, 10);
const slugify = (value: string) => value.toLocaleLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const csv = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
const placeholderImage = '/images/places/unvisited/placeholder.svg';

type EditorSection = 'basics' | 'location' | 'classification' | 'images' | 'visits';
type EditorCommand = { type: 'log-visit' | 'add-review'; token: number };
type PlaceSelectionAction = EditorCommand['type'];

const editorSections: ReadonlyArray<{ id: EditorSection; label: string; description: string }> = [
  { id: 'basics', label: 'Basics', description: 'Name, status, and description' },
  { id: 'location', label: 'Location and links', description: 'Map, menu, phone, and reservations' },
  { id: 'classification', label: 'Tags, price, and diet', description: 'Styles, dietary options, and public filters' },
  { id: 'images', label: 'Images', description: 'Cover and gallery' },
  { id: 'visits', label: 'Visit history', description: 'Visits, dishes, and reviews' },
];

function signInErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  const message = error instanceof Error ? error.message : '';
  if (code === 'auth/operation-not-allowed') return 'Google sign-in is not enabled for this Firebase project. Enable Authentication > Sign-in method > Google in Firebase Console.';
  if (code === 'auth/unauthorized-domain') return 'This domain is not authorized for Firebase Authentication. Add localhost and the GitHub Pages domain under Authentication > Settings > Authorized domains.';
  if (code === 'auth/popup-blocked') return 'The browser blocked the Google sign-in popup. Allow popups for this site and try again.';
  if (code === 'auth/popup-closed-by-user') return 'Google sign-in popup closed before sign-in completed.';
  return `Google sign-in did not complete.${code ? ` (${code})` : ''}${message ? ` ${message}` : ''}`;
}

function newPlace(input: Partial<FirestorePlace> = {}): FirestorePlace {
  const name = input.name ?? 'New place';
  return parsePlaceDocument({
    id: 'new-place',
    fictional: false,
    name,
    description: 'Add a short factual description.',
    status: 'want-to-visit',
    addedAt: today(),
    location: {
      address: 'Address',
      city: 'Givatayim',
      latitude: 32.07,
      longitude: 34.81,
      mapUrl: 'https://maps.google.com/',
      ...input.location,
    },
    links: {},
    priceRange: '$$',
    currency: 'ILS',
    ramenStyles: [],
    dietaryOptions: [],
    tags: [],
    coverImage: { src: placeholderImage, alt: `${name} placeholder image` },
    gallery: [],
    visits: [],
    archived: false,
    ...input,
  });
}

const newVisit = (visits: Visit[]): Visit => {
  const baseId = `visit-${today()}`;
  const usedIds = new Set(visits.map(({ id }) => id));
  let id = baseId;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }
  return { id, date: today(), photos: [], dishes: [], reviews: [] };
};

function Field({
  label,
  value,
  onInput,
  required = false,
  type = 'text',
  readOnly = false,
  step,
  help,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string | number;
  onInput: (value: string) => void;
  required?: boolean;
  type?: string;
  readOnly?: boolean;
  step?: string;
  help?: string;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <label class={multiline ? 'manage-field manage-field--wide' : 'manage-field'}>
      <span>{label}</span>
      {multiline ? (
        <textarea value={value} required={required} readOnly={readOnly} placeholder={placeholder} rows={4} onInput={(event) => onInput(event.currentTarget.value)} />
      ) : (
        <input type={type} value={value} required={required} readOnly={readOnly} step={step} placeholder={placeholder} onInput={(event) => onInput(event.currentTarget.value)} />
      )}
      {help && <small>{help}</small>}
    </label>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<readonly [T, string]>;
  onChange: (value: T) => void;
}) {
  return (
    <label class="manage-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.currentTarget.value as T)}>
        {options.map(([optionValue, text]) => <option value={optionValue} key={optionValue}>{text}</option>)}
      </select>
    </label>
  );
}

function SectionCard({ eyebrow, title, children, action }: { eyebrow: string; title: string; children: ComponentChildren; action?: ComponentChildren }) {
  return (
    <section class="manage-card">
      <header class="manage-card__header">
        <div>
          <p class="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function Modal({
  title,
  eyebrow,
  children,
  onClose,
  preventClose = false,
  panelClass = '',
}: {
  title: string;
  eyebrow: string;
  children: ComponentChildren;
  onClose: () => void;
  preventClose?: boolean;
  panelClass?: string;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  const preventCloseRef = useRef(preventClose);
  closeRef.current = onClose;
  preventCloseRef.current = preventClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableSelector = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])';
    const focusDialog = () => {
      const firstControl = dialog?.querySelector<HTMLElement>('[data-modal-initial-focus]')
        ?? dialog?.querySelector<HTMLElement>(focusableSelector);
      (firstControl ?? dialog)?.focus();
    };
    const frame = requestAnimationFrame(focusDialog);
    const viewport = window.visualViewport;
    const syncVisualViewport = () => {
      if (!dialog || !viewport) return;
      dialog.style.setProperty('--modal-viewport-height', `${viewport.height}px`);
      dialog.style.setProperty('--modal-viewport-top', `${viewport.offsetTop}px`);
    };
    syncVisualViewport();
    viewport?.addEventListener('resize', syncVisualViewport);
    viewport?.addEventListener('scroll', syncVisualViewport);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !preventCloseRef.current) {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;

      const controls = [...dialog.querySelectorAll<HTMLElement>(focusableSelector)]
        .filter((control) => control.offsetParent !== null);
      if (controls.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      const activeControl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (!activeControl || !dialog.contains(activeControl) || !controls.includes(activeControl)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && activeControl === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeControl === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.classList.add('modal-open');
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', syncVisualViewport);
      viewport?.removeEventListener('scroll', syncVisualViewport);
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('modal-open');
      previousFocus?.focus();
    };
  }, []);

  const requestClose = () => {
    if (!preventClose) onClose();
  };

  return (
    <div class="manage-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      <section ref={dialogRef} tabIndex={-1} class={`manage-modal ${panelClass}`.trim()} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header class="manage-modal__header">
          <div>
            <p class="eyebrow">{eyebrow}</p>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button type="button" class="manage-secondary" data-modal-initial-focus onClick={requestClose} disabled={preventClose}>Close</button>
        </header>
        {children}
      </section>
    </div>
  );
}

function StartPlaceModal({ onCreate, onClose }: { onCreate: (place: FirestorePlace) => void; onClose: () => void }) {
  const [mapsUrl, setMapsUrl] = useState('');
  const [manualName, setManualName] = useState('');
  const [status, setStatus] = useState<FirestorePlace['status']>('want-to-visit');
  const parsed = parseGoogleMapsUrl(mapsUrl);
  const name = manualName || parsed?.name || 'New place';
  const city = parsed?.city || 'Givatayim';
  const address = parsed?.address || parsed?.name || 'Address';
  const canCreate = mapsUrl.trim().length > 0 && parsed !== null;

  const create = (event: Event) => {
    event.preventDefault();
    if (!canCreate) return;
    onCreate(newPlace({
      id: slugify(name),
      name,
      status,
      description: `${name} saved for a future ramen visit.`,
      location: {
        address,
        city,
        latitude: parsed.latitude ?? 32.07,
        longitude: parsed.longitude ?? 34.81,
        mapUrl: parsed.mapUrl,
      },
      tags: ['saved'],
      coverImage: { src: placeholderImage, alt: `Illustration marking ${name} as a place waiting to be visited` },
    }));
    onClose();
  };

  return (
    <Modal eyebrow="New place" title="Paste a Google Maps link" onClose={onClose}>
      <form class="manage-modal-form" aria-label="New place details" tabIndex={0} onSubmit={create}>
        <Field label="Google Maps URL" value={mapsUrl} type="url" required placeholder="https://www.google.com/maps/..." help="We can usually derive name, address, city, latitude, and longitude from the URL. Website, phone, and menu still need manual edits unless they are in the link text." onInput={setMapsUrl} />
        <Field label="Name override" value={manualName} placeholder={parsed?.name ?? 'Optional'} help="Use this only if the Maps URL does not expose a clean place name." onInput={setManualName} />
        <SelectField label="Status" value={status} options={[['want-to-visit', 'Want to visit'], ['visited', 'Visited'], ['unavailable', 'Unavailable']]} onChange={setStatus} />
        {mapsUrl && (
          <div class="maps-preview" aria-live="polite">
            {parsed ? (
              <>
                <strong>{name}</strong>
                <span>{address}</span>
                <span>{city}</span>
                <span>{parsed.latitude !== undefined && parsed.longitude !== undefined ? `${parsed.latitude}, ${parsed.longitude}` : 'Coordinates not visible in this URL'}</span>
              </>
            ) : (
              <span>That does not look like a full Maps URL yet.</span>
            )}
          </div>
        )}
        <div class="manage-modal-actions">
          <button type="button" class="manage-secondary" onClick={onClose}>Cancel</button>
          <button class="manage-primary" type="submit" disabled={!canCreate}>Start place</button>
        </div>
      </form>
    </Modal>
  );
}

function ReviewEditor({ review, onChange, onRemove }: { review: Review; onChange: (review: Review) => void; onRemove: () => void }) {
  const rating = (key: RatingKey, value: string) => {
    const ratings = { ...review.ratings };
    if (value === '') delete ratings[key];
    else ratings[key] = Number(value);
    onChange({ ...review, ratings });
  };
  const score = scoreReview(review);

  return (
    <article class="review-editor">
      <header>
        <div>
          <p class="eyebrow">Reviewer</p>
          <h5>{review.reviewerName || 'Unnamed reviewer'}</h5>
        </div>
        <strong>{formatScore(score)}</strong>
      </header>
      <div class="manage-grid">
        <Field label="Reviewer ID" value={review.reviewerId} required help="Stable lowercase ID, e.g. eyal." onInput={(reviewerId) => onChange({ ...review, reviewerId: slugify(reviewerId) })} />
        <Field label="Reviewer name" value={review.reviewerName} required onInput={(reviewerName) => onChange({ ...review, reviewerName })} />
        <Field label="Notes" value={review.notes ?? ''} multiline placeholder="What stood out? Broth, noodles, service…" onInput={(notes) => onChange({ ...review, notes: notes || undefined })} />
      </div>
      <div class="rating-editor">
        {RATING_CATEGORIES.map(({ key, label }) => (
          <label key={key}>
            <span>{label}</span>
            <input type="number" min="1" max="10" step="1" value={review.ratings[key] ?? ''} placeholder="—" onInput={(event) => rating(key, event.currentTarget.value)} />
          </label>
        ))}
      </div>
      <button type="button" class="manage-link danger" onClick={onRemove}>Remove reviewer</button>
    </article>
  );
}

function displayVisitDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

export function ReviewComposer({
  placeName,
  visit,
  visits,
  hasUnsavedPlaceChanges,
  onSave,
  onClose,
}: {
  placeName: string;
  visit: Visit;
  visits: Visit[];
  hasUnsavedPlaceChanges: boolean;
  onSave: (review: Review) => Promise<void>;
  onClose: () => void;
}) {
  const allReviewers = knownReviewers(visits);
  const reviewerChoices = availableReviewers(visits, visit);
  const initialReviewer = reviewerChoices[0];
  const [selectedReviewerId, setSelectedReviewerId] = useState(initialReviewer?.reviewerId ?? '__new__');
  const [newReviewerName, setNewReviewerName] = useState('');
  const [review, setReview] = useState<Review>(() => createReview(initialReviewer ?? { reviewerId: '', reviewerName: '' }));
  const [activeRating, setActiveRating] = useState<RatingKey>('broth');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const scoreGroupId = useId();
  const activeLegendRef = useRef<HTMLLegendElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const saveStatusRef = useRef<HTMLParagraphElement>(null);
  const ratedCount = RATING_CATEGORIES.filter(({ key }) => review.ratings[key] !== undefined).length;
  const score = scoreReview(review);
  const activeLabel = RATING_CATEGORIES.find(({ key }) => key === activeRating)?.label ?? activeRating;
  const hasDraftContent = ratedCount > 0 || Boolean(review.notes?.trim()) || Boolean(newReviewerName.trim());

  const focusActiveRating = () => requestAnimationFrame(() => activeLegendRef.current?.focus());
  const showError = (message: string) => {
    setError(message);
    requestAnimationFrame(() => errorRef.current?.focus());
  };
  const requestClose = () => {
    if (saving) return;
    if (hasDraftContent && !window.confirm('Discard this review?')) return;
    onClose();
  };
  const chooseReviewer = (reviewerId: string) => {
    setSelectedReviewerId(reviewerId);
    setError('');
    if (reviewerId === '__new__') {
      setReview((current) => ({ ...current, reviewerId: '', reviewerName: '' }));
      return;
    }
    const identity = reviewerChoices.find((candidate) => candidate.reviewerId === reviewerId);
    if (identity) setReview((current) => ({ ...current, ...identity }));
  };
  const rate = (value: number, advance: boolean) => {
    const nextReview = setReviewRating(review, activeRating, value);
    setReview(nextReview);
    setError('');
    if (advance) {
      setActiveRating(nextUnratedRatingKey(nextReview.ratings, activeRating));
      focusActiveRating();
    }
  };
  const skip = () => {
    const nextReview = setReviewRating(review, activeRating, null);
    setReview(nextReview);
    setActiveRating(nextUnratedRatingKey(nextReview.ratings, activeRating));
    focusActiveRating();
  };
  const resolveIdentity = (): ReviewerIdentity | null => {
    if (selectedReviewerId !== '__new__') {
      return reviewerChoices.find(({ reviewerId }) => reviewerId === selectedReviewerId) ?? null;
    }
    const reviewerName = newReviewerName.trim();
    if (!reviewerName) return null;
    const existingIdentity = allReviewers.find((candidate) => candidate.reviewerName.toLocaleLowerCase() === reviewerName.toLocaleLowerCase());
    if (existingIdentity) return existingIdentity;
    return {
      reviewerId: reviewerIdFromName(reviewerName, allReviewers.map(({ reviewerId }) => reviewerId)),
      reviewerName,
    };
  };
  const submit = async (event: Event) => {
    event.preventDefault();
    if (saving) return;
    const identity = resolveIdentity();
    if (!identity) {
      showError('Choose a reviewer or enter a new reviewer name.');
      return;
    }
    if (visit.reviews.some(({ reviewerId }) => reviewerId === identity.reviewerId)) {
      showError(`${identity.reviewerName} already reviewed this visit.`);
      return;
    }
    const notes = review.notes?.trim();
    if (ratedCount === 0 && !notes) {
      showError('Add at least one score or a note before saving.');
      return;
    }

    saveStatusRef.current?.focus();
    setSaving(true);
    setError('');
    try {
      await onSave({
        ...review,
        ...identity,
        ...(notes ? { notes } : { notes: undefined }),
      });
      onClose();
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : 'The review could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      eyebrow={`${placeName} · ${displayVisitDate(visit.date)}`}
      title="Add review"
      onClose={requestClose}
      preventClose={saving}
      panelClass="review-composer-modal"
    >
      <form class="manage-modal-form review-composer-form" aria-label="Review details" tabIndex={0} onSubmit={submit}>
        <fieldset class="review-composer-lock" disabled={saving} aria-busy={saving}>
        <label class="manage-field review-composer-reviewer">
          <span>Who is reviewing?</span>
          {reviewerChoices.length > 0 ? (
            <select value={selectedReviewerId} onChange={(event) => chooseReviewer(event.currentTarget.value)}>
              {reviewerChoices.map(({ reviewerId, reviewerName }) => <option value={reviewerId} key={reviewerId}>{reviewerName}</option>)}
              <option value="__new__">Add a new reviewer</option>
            </select>
          ) : <span class="review-composer-empty-choice">No saved reviewers are available for this visit.</span>}
        </label>

        {(selectedReviewerId === '__new__' || reviewerChoices.length === 0) && (
          <label class="manage-field">
            <span>New reviewer name</span>
            <input
              type="text"
              value={newReviewerName}
              autocomplete="name"
              onInput={(event) => {
                setNewReviewerName(event.currentTarget.value);
                setReview((current) => ({ ...current, reviewerId: '', reviewerName: event.currentTarget.value }));
                setError('');
              }}
            />
          </label>
        )}

        <section class="review-composer-scores" aria-labelledby={`${scoreGroupId}-scores-title`}>
          <header class="review-composer-score-header">
            <div>
              <p class="eyebrow">Scores</p>
              <h3 id={`${scoreGroupId}-scores-title`}>Rate what mattered</h3>
            </div>
            <strong>{formatScore(score)}</strong>
          </header>

          <fieldset class="review-score-picker" aria-describedby={`${scoreGroupId}-score-hint`}>
            <legend ref={activeLegendRef} tabIndex={-1}>{activeLabel} · choose 1–10</legend>
            <p class="review-score-hint" id={`${scoreGroupId}-score-hint`}>Tap a score to move to the next unrated category. Keyboard selection stays here.</p>
            <div class="review-score-options">
              {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => {
                const id = `${scoreGroupId}-${activeRating}-${value}`;
                return (
                  <span class="review-score-choice" key={value}>
                    <input
                      class="review-score-input"
                      id={id}
                      name={`${scoreGroupId}-${activeRating}-score`}
                      type="radio"
                      value={value}
                      checked={review.ratings[activeRating] === value}
                      onClick={(event) => rate(value, event.detail > 0)}
                    />
                    <label class="review-score-option" for={id}>{value}</label>
                  </span>
                );
              })}
            </div>
            <button type="button" class="review-composer-skip" onClick={skip}>Skip · not rated</button>
          </fieldset>

          <div class="review-category-grid" aria-label="Rating categories">
            {RATING_CATEGORIES.map(({ key, label }) => (
              <button
                type="button"
                class="review-category-button"
                aria-pressed={activeRating === key}
                aria-label={`${label}, ${review.ratings[key] === undefined ? 'not rated' : `rated ${review.ratings[key]}`}`}
                onClick={() => { setActiveRating(key); focusActiveRating(); }}
                key={key}
              >
                <span>{label}</span>
                <strong>{review.ratings[key] ?? '—'}</strong>
              </button>
            ))}
          </div>
        </section>

        <label class="manage-field">
          <span>Notes <small>(optional)</small></span>
          <textarea
            value={review.notes ?? ''}
            rows={3}
            placeholder="What stood out about the bowl?"
            onInput={(event) => { setReview({ ...review, notes: event.currentTarget.value || undefined }); setError(''); }}
          />
        </label>

        {hasUnsavedPlaceChanges && <p class="review-composer-warning">Saving this review also saves your other place edits.</p>}
        </fieldset>
        {error && <p ref={errorRef} class="review-composer-error" role="alert" tabIndex={-1}>{error}</p>}

        <div class="review-composer-actions">
          <p ref={saveStatusRef} class="review-composer-status" aria-live="polite" aria-atomic="true" tabIndex={-1}>
            {saving ? 'Saving review…' : `${ratedCount} of ${RATING_CATEGORIES.length} rated${score === null ? '' : ` · Average ${formatScore(score)}`}`}
          </p>
          <button class="manage-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save review'}</button>
        </div>
      </form>
    </Modal>
  );
}

function VisitEditor({
  visit,
  number,
  onChange,
  onRemove,
  onRequestAddReview,
}: {
  visit: Visit;
  number: number;
  onChange: (visit: Visit) => void;
  onRemove: () => void;
  onRequestAddReview: () => void;
}) {
  const changeReview = (index: number, review: Review) => onChange({ ...visit, reviews: visit.reviews.map((item, i) => i === index ? review : item) });
  const dishes = (value: string) => csv(value).map((dish) => {
    const [name, notes] = dish.split('|').map((part) => part.trim());
    return { name, ...(notes ? { notes } : {}) };
  });
  const photos = (value: string) => csv(value).map((entry) => {
    const [src, alt, caption] = entry.split('|').map((part) => part.trim());
    return { src, alt, ...(caption ? { caption } : {}) };
  });

  return (
    <section class="visit-editor">
      <header class="visit-editor__header">
        <div>
          <p class="eyebrow">Visit {number}</p>
          <h4>{visit.date}</h4>
        </div>
        <button type="button" class="manage-link danger" onClick={onRemove}>Remove visit</button>
      </header>
      <div class="manage-grid">
        <Field label="Visit ID" value={visit.id} required help="Must be unique inside this place." onInput={(id) => onChange({ ...visit, id: slugify(id) })} />
        <Field label="Date" value={visit.date} type="date" required onInput={(date) => onChange({ ...visit, date })} />
        <Field label="Visit notes" value={visit.notes ?? ''} multiline placeholder="Short summary for this visit…" onInput={(notes) => onChange({ ...visit, notes: notes || undefined })} />
        <Field label="Dishes" value={visit.dishes.map(({ name, notes }) => `${name}${notes ? ` | ${notes}` : ''}`).join(', ')} help="Format: name | notes, comma-separated." onInput={(value) => onChange({ ...visit, dishes: dishes(value) })} />
        <Field label="Visit photos" value={visit.photos.map(({ src, alt, caption }) => `${src} | ${alt}${caption ? ` | ${caption}` : ''}`).join(', ')} help="Format: URL/path | alt | caption." onInput={(value) => onChange({ ...visit, photos: photos(value) })} />
      </div>
      <div class="manage-card__header compact">
        <div>
          <p class="eyebrow">Scores</p>
          <h4>Reviews</h4>
        </div>
        <button type="button" class="manage-secondary" onClick={onRequestAddReview}>Add review</button>
      </div>
      <div class="review-editor-list">
        {visit.reviews.map((review, index) => (
          <ReviewEditor key={`${review.reviewerId}-${index}`} review={review} onChange={(value) => changeReview(index, value)} onRemove={() => onChange({ ...visit, reviews: visit.reviews.filter((_, i) => i !== index) })} />
        ))}
        {visit.reviews.length === 0 && <p class="review-editor-empty">Add the first review to finish this visit.</p>}
      </div>
    </section>
  );
}

function PlaceEditor({
  initial,
  isNew,
  initialCommand,
  onSaved,
  onBack,
}: {
  initial: FirestorePlace;
  isNew: boolean;
  initialCommand?: EditorCommand;
  onSaved: (place: FirestorePlace, announce?: boolean) => void;
  onBack: () => void;
}) {
  const [place, setPlace] = useState(initial);
  const [message, setMessage] = useState('');
  const [activeSection, setActiveSection] = useState<EditorSection>('basics');
  const [reviewVisitId, setReviewVisitId] = useState<string>();
  const [pendingNewVisitId, setPendingNewVisitId] = useState<string>();
  const [savingPlace, setSavingPlace] = useState(false);
  const savingPlaceRef = useRef(false);
  const handledCommandRef = useRef<number>();
  const placeMessageRef = useRef<HTMLParagraphElement>(null);
  const reviewSavedRef = useRef(false);
  const set = <K extends keyof FirestorePlace>(key: K, value: FirestorePlace[K]) => setPlace((current) => ({ ...current, [key]: value }));
  const updateVisit = (index: number, visit: Visit) => set('visits', place.visits.map((item, i) => i === index ? visit : item));
  const applyMapsUrl = (mapUrl: string) => {
    const parsed = parseGoogleMapsUrl(mapUrl);
    setPlace((current) => ({
      ...current,
      name: isNew && parsed?.name ? parsed.name : current.name,
      id: isNew && parsed?.name ? slugify(parsed.name) : current.id,
      location: {
        ...current.location,
        mapUrl,
        ...(parsed?.address ? { address: parsed.address } : {}),
        ...(parsed?.city ? { city: parsed.city } : {}),
        ...(parsed?.latitude !== undefined ? { latitude: parsed.latitude } : {}),
        ...(parsed?.longitude !== undefined ? { longitude: parsed.longitude } : {}),
      },
    }));
  };

  const persist = async (candidate: FirestorePlace, expectedUpdatedAt = place.updatedAt, announce = true) => {
    if (savingPlaceRef.current) throw new Error('A save is already in progress.');
    savingPlaceRef.current = true;
    setSavingPlace(true);
    try {
      const validated = parsePlaceDocument(candidate);
      const saved = await savePlace(validated, expectedUpdatedAt);
      setPlace(saved);
      onSaved(saved, announce);
      return saved;
    } finally {
      savingPlaceRef.current = false;
      setSavingPlace(false);
    }
  };
  const save = async (event: Event) => {
    event.preventDefault();
    setMessage('Saving…');
    requestAnimationFrame(() => placeMessageRef.current?.focus());
    try {
      await persist(place);
      setMessage('Saved. Public pages will show this version when refreshed.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The place could not be saved.');
    }
  };
  const addVisit = () => {
    const visit = newVisit(place.visits);
    setPlace((current) => ({ ...current, visits: [...current.visits, visit] }));
    setPendingNewVisitId(visit.id);
    reviewSavedRef.current = false;
    setReviewVisitId(visit.id);
  };
  const closeReviewComposer = () => {
    if (reviewVisitId === pendingNewVisitId) {
      setPlace((current) => ({
        ...current,
        visits: current.visits.filter(({ id, reviews }) => id !== pendingNewVisitId || reviews.length > 0),
      }));
      setPendingNewVisitId(undefined);
    }
    setReviewVisitId(undefined);
    if (reviewSavedRef.current) {
      setMessage('Review saved. Public pages will show it when refreshed.');
      reviewSavedRef.current = false;
    }
  };
  const saveReview = async (review: Review) => {
    if (!reviewVisitId) throw new Error('Visit no longer exists.');
    const saved = await saveReviewToVisit(
      place,
      reviewVisitId,
      review,
      (candidate, expectedUpdatedAt) => persist(candidate, expectedUpdatedAt, false),
    );
    setPlace(saved);
    setPendingNewVisitId(undefined);
    reviewSavedRef.current = true;
  };
  const selectedReviewVisit = place.visits.find(({ id }) => id === reviewVisitId);
  const withoutVersion = ({ updatedAt: _updatedAt, ...value }: FirestorePlace) => value;
  const hasUnsavedPlaceChanges = JSON.stringify(withoutVersion(place)) !== JSON.stringify(withoutVersion(initial));
  useEffect(() => {
    if (!initialCommand || handledCommandRef.current === initialCommand.token) return;
    handledCommandRef.current = initialCommand.token;
    setActiveSection('visits');
    if (initialCommand.type === 'log-visit') addVisit();
    else setMessage('Choose a visit below, then select Add review.');
  }, [initialCommand?.token]);
  const requestBack = () => {
    if (savingPlace) return;
    if ((isNew || hasUnsavedPlaceChanges) && !window.confirm(isNew ? 'Discard this new place?' : 'Discard unsaved place changes?')) return;
    onBack();
  };

  return (
    <>
    <form class="manage-editor" onSubmit={save}>
      {message && <p ref={placeMessageRef} class="manage-message" aria-live="polite" tabIndex={-1}>{message}</p>}
      <fieldset class="manage-editor-fields" disabled={savingPlace} aria-busy={savingPlace}>
      <div class="manage-editor-hero">
        <div>
          <button type="button" class="manage-mobile-back" onClick={requestBack}>← Places</button>
          <p class="eyebrow">{isNew ? 'Create place' : 'Edit place'}</p>
          <h2>{place.name}</h2>
          <p>{place.location.city} · {place.status.replaceAll('-', ' ')} · {place.visits.length} {place.visits.length === 1 ? 'visit' : 'visits'}</p>
        </div>
        <button class="manage-primary" type="submit">{savingPlace ? 'Saving…' : 'Save place'}</button>
      </div>

      <nav class="manage-section-nav" aria-label="Edit place sections">
        {editorSections.map(({ id, label, description }) => (
          <button
            type="button"
            class={activeSection === id ? 'manage-section-button active' : 'manage-section-button'}
            aria-pressed={activeSection === id}
            aria-controls={`manage-section-${id}`}
            onClick={() => setActiveSection(id)}
            key={id}
          >
            <strong>{label}</strong>
            <span>{description}</span>
          </button>
        ))}
      </nav>

      <div id="manage-section-basics" class={`manage-section-panel${activeSection === 'basics' ? ' is-active' : ''}`} data-manage-section="basics">
      <SectionCard eyebrow="Basics" title="Place details">
        <div class="manage-grid">
          <Field label="ID" value={place.id} required readOnly={!isNew} help="Used in URLs and Firestore. Cannot change after creation." onInput={(id) => set('id', slugify(id))} />
          <Field label="Name" value={place.name} required onInput={(name) => set('name', name)} />
          <Field label="Alternate name" value={place.alternateName ?? ''} onInput={(alternateName) => set('alternateName', alternateName || undefined)} />
          <SelectField label="Status" value={place.status} options={[['want-to-visit', 'Want to visit'], ['visited', 'Visited'], ['unavailable', 'Unavailable']]} onChange={(status) => set('status', status)} />
          <Field label="Added date" value={place.addedAt} type="date" required onInput={(addedAt) => set('addedAt', addedAt)} />
          <Field label="Description" value={place.description} required multiline placeholder="One or two sentences for the public page." onInput={(description) => set('description', description)} />
          <label class="manage-check"><input type="checkbox" checked={place.fictional} onChange={(event) => set('fictional', event.currentTarget.checked)} /> Fictional example</label>
          <label class="manage-check"><input type="checkbox" checked={place.archived} onChange={(event) => set('archived', event.currentTarget.checked)} /> Archived, hidden publicly</label>
        </div>
      </SectionCard>
      </div>

      <div id="manage-section-location" class={`manage-section-panel${activeSection === 'location' ? ' is-active' : ''}`} data-manage-section="location">
      <SectionCard eyebrow="Where" title="Location and links">
        <div class="manage-grid">
          <Field label="Address" value={place.location.address} required onInput={(address) => set('location', { ...place.location, address })} />
          <Field label="City" value={place.location.city} required onInput={(city) => set('location', { ...place.location, city })} />
          <Field label="Latitude" value={place.location.latitude} type="number" step="any" required onInput={(latitude) => set('location', { ...place.location, latitude: Number(latitude) })} />
          <Field label="Longitude" value={place.location.longitude} type="number" step="any" required onInput={(longitude) => set('location', { ...place.location, longitude: Number(longitude) })} />
          <Field label="Google Maps URL" value={place.location.mapUrl} type="url" required help="Paste the Maps link first; visible name/address/city/coordinates are filled automatically when possible." onInput={applyMapsUrl} />
          <Field label="Website URL" value={place.links.website ?? ''} type="url" onInput={(website) => set('links', { ...place.links, website: website || undefined })} />
          <Field label="Menu URL" value={place.links.menu ?? ''} type="url" onInput={(menu) => set('links', { ...place.links, menu: menu || undefined })} />
          <Field label="Reservations URL" value={place.links.reservations ?? ''} type="url" onInput={(reservations) => set('links', { ...place.links, reservations: reservations || undefined })} />
          <Field label="Phone" value={place.links.phone ?? ''} onInput={(phone) => set('links', { ...place.links, phone: phone || undefined })} />
        </div>
      </SectionCard>
      </div>

      <div id="manage-section-classification" class={`manage-section-panel${activeSection === 'classification' ? ' is-active' : ''}`} data-manage-section="classification">
      <SectionCard eyebrow="Tags" title="Classification">
        <div class="manage-grid">
          <SelectField label="Price range" value={place.priceRange} options={[['$', '$'], ['$$', '$$'], ['$$$', '$$$'], ['$$$$', '$$$$']]} onChange={(priceRange) => set('priceRange', priceRange)} />
          <Field label="Currency" value={place.currency} required onInput={(currency) => set('currency', currency.toUpperCase())} />
          <Field label="Ramen styles" value={place.ramenStyles.join(', ')} help="Comma-separated, e.g. shoyu, tonkotsu." onInput={(value) => set('ramenStyles', csv(value))} />
          <Field label="Dietary options" value={place.dietaryOptions.join(', ')} help="Comma-separated." onInput={(value) => set('dietaryOptions', csv(value))} />
          <Field label="Tags" value={place.tags.join(', ')} help="Comma-separated public filters." onInput={(value) => set('tags', csv(value))} />
          <Field label="Opening-hours note" value={place.openingHoursNote ?? ''} onInput={(openingHoursNote) => set('openingHoursNote', openingHoursNote || undefined)} />
        </div>
      </SectionCard>
      </div>

      <div id="manage-section-images" class={`manage-section-panel${activeSection === 'images' ? ' is-active' : ''}`} data-manage-section="images">
      <SectionCard eyebrow="Images" title="Cover and gallery">
        <div class="manage-grid">
          <Field label="Cover image URL/path" value={place.coverImage.src} required help="Use /images/places/... or an HTTPS URL." onInput={(src) => set('coverImage', { ...place.coverImage, src })} />
          <Field label="Cover alt text" value={place.coverImage.alt} required onInput={(alt) => set('coverImage', { ...place.coverImage, alt })} />
          <Field label="Cover caption" value={place.coverImage.caption ?? ''} onInput={(caption) => set('coverImage', { ...place.coverImage, caption: caption || undefined })} />
          <Field label="Gallery" value={place.gallery.map(({ src, alt, caption }) => `${src} | ${alt}${caption ? ` | ${caption}` : ''}`).join(', ')} multiline help="Format: URL/path | alt | caption, comma-separated." onInput={(value) => set('gallery', csv(value).map((entry) => { const [src, alt, caption] = entry.split('|').map((part) => part.trim()); return { src, alt, ...(caption ? { caption } : {}) }; }))} />
        </div>
      </SectionCard>
      </div>

      <div id="manage-section-visits" class={`manage-section-panel${activeSection === 'visits' ? ' is-active' : ''}`} data-manage-section="visits">
      <SectionCard eyebrow="Visits" title="Visit log" action={<button type="button" class="manage-secondary" onClick={addVisit}>Add visit</button>}>
        {place.visits.length > 0 ? (
          <div class="visit-editor-list">
            {place.visits.map((visit, index) => <VisitEditor key={`${visit.id}-${index}`} visit={visit} number={index + 1} onChange={(value) => updateVisit(index, value)} onRemove={() => set('visits', place.visits.filter((_, i) => i !== index))} onRequestAddReview={() => { reviewSavedRef.current = false; setReviewVisitId(visit.id); }} />)}
          </div>
        ) : (
          <div class="manage-empty compact">
            <h4>No visits yet</h4>
            <p>Add a visit when somebody actually tries the ramen.</p>
          </div>
        )}
      </SectionCard>
      </div>
      </fieldset>
    </form>
    {selectedReviewVisit && (
      <ReviewComposer
        placeName={place.name}
        visit={selectedReviewVisit}
        visits={place.visits}
        hasUnsavedPlaceChanges={hasUnsavedPlaceChanges}
        onSave={saveReview}
        onClose={closeReviewComposer}
      />
    )}
    </>
  );
}

export default function ManageApp() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [approved, setApproved] = useState<boolean | undefined>(undefined);
  const [places, setPlaces] = useState<FirestorePlace[]>([]);
  const [placesLoaded, setPlacesLoaded] = useState(false);
  const [selected, setSelected] = useState<FirestorePlace>();
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [startingPlace, setStartingPlace] = useState(false);
  const [pendingPlaceAction, setPendingPlaceAction] = useState<PlaceSelectionAction>();
  const [editorCommand, setEditorCommand] = useState<EditorCommand>();
  const intentRef = useRef(typeof location === 'undefined'
    ? { action: null, placeId: null }
    : readManageIntent(location.search));
  const handledIntentRef = useRef(false);
  const commandTokenRef = useRef(0);

  useEffect(() => observeUser((nextUser) => {
    setUser(nextUser);
    setApproved(undefined);
    setPlacesLoaded(false);
  }), []);
  useEffect(() => {
    if (!user) {
      setApproved(false);
      setPlacesLoaded(false);
      return;
    }
    let active = true;
    void isApprovedEditor(user.uid).then(async (allowed) => {
      if (!active) return;
      setApproved(allowed);
      if (!allowed) return;
      const nextPlaces = await listEditorPlaces();
      if (!active) return;
      setPlaces(nextPlaces);
      setPlacesLoaded(true);
    }).catch(() => {
      if (active) setError('Editor access or the place list could not be loaded.');
    });
    return () => { active = false; };
  }, [user]);
  useEffect(() => {
    if (!approved || !placesLoaded || handledIntentRef.current) return;
    handledIntentRef.current = true;
    const { action, placeId } = intentRef.current;

    if (action && typeof location !== 'undefined') {
      const url = new URL(location.href);
      url.searchParams.delete('action');
      history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }
    if (action === 'add-place') {
      setStartingPlace(true);
      return;
    }

    const target = placeId ? places.find(({ id }) => id === placeId) : undefined;
    if (placeId && !target) {
      setNotice(`The place “${placeId}” is not available in the editor.`);
      return;
    }
    if (target) {
      setSelected(target);
      setIsNew(false);
    }
    if ((action === 'log-visit' || action === 'add-review') && target) {
      commandTokenRef.current += 1;
      setEditorCommand({ type: action, token: commandTokenRef.current });
      return;
    }
    if (action === 'log-visit' || action === 'add-review') {
      setPendingPlaceAction(action);
      setNotice(action === 'log-visit'
        ? 'Choose the place you visited.'
        : 'Choose a place, then choose the visit you want to review.');
    } else if (action === 'edit-place' && !target) {
      setNotice('Choose a place to edit.');
    }
  }, [approved, placesLoaded, places]);

  if (error) return <LoadState><h1>Manage Ramen Radar</h1><p>{error}</p></LoadState>;
  if (user === undefined || (user && (approved === undefined || (approved && !placesLoaded)))) return <LoadState><p>Checking editor access…</p></LoadState>;
  if (!user) return <LoadState><h1>Manage Ramen Radar</h1><p>Sign in with an approved Google account to add places and reviews.</p><button class="manage-primary" onClick={() => void signInWithGoogle().catch((reason) => setError(signInErrorMessage(reason)))}>Sign in with Google</button></LoadState>;
  if (!approved) return <LoadState><h1>Access pending</h1><p>You signed in successfully, but this account is not in the editor allowlist. Ask the project owner to add UID <code>{user.uid}</code> to the <code>editors</code> collection.</p><button onClick={() => void signOutUser()}>Sign out</button></LoadState>;

  const replacePlaceInLocation = (placeId?: string) => {
    if (typeof location === 'undefined') return;
    const url = new URL(location.href);
    if (placeId) url.searchParams.set('place', placeId);
    else url.searchParams.delete('place');
    history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
  };
  const choose = (place: FirestorePlace) => {
    setNotice('');
    setSelected(place);
    setIsNew(false);
    replacePlaceInLocation(place.id);
    if (pendingPlaceAction) {
      commandTokenRef.current += 1;
      setEditorCommand({ type: pendingPlaceAction, token: commandTokenRef.current });
      setPendingPlaceAction(undefined);
    } else {
      setEditorCommand(undefined);
    }
  };
  const closeEditor = () => {
    setSelected(undefined);
    setIsNew(false);
    setEditorCommand(undefined);
    setNotice('');
    replacePlaceInLocation();
  };
  const saved = (place: FirestorePlace, announce = true) => {
    setPlaces((current) => [...current.filter(({ id }) => id !== place.id), place].sort((a, b) => a.name.localeCompare(b.name)));
    setSelected(place);
    setIsNew(false);
    if (announce) setNotice('Saved. Public pages will show this version when refreshed.');
  };
  return (
    <main class="manage-shell shell">
      <header class="manage-top">
        <div>
          <p class="eyebrow">Private editor</p>
          <h1>Manage Ramen Radar</h1>
          <p>Signed in as {user.email ?? user.displayName ?? user.uid}</p>
        </div>
        <button class="manage-secondary" onClick={() => void signOutUser()}>Sign out</button>
      </header>
      {notice && <p class="manage-message" aria-live="polite">{notice}</p>}

      <div class={selected ? 'manage-layout manage-layout--editing' : 'manage-layout'}>
        <aside class="manage-sidebar">
          <div class="manage-sidebar-card">
            <button class="manage-primary" onClick={() => { setNotice(''); setStartingPlace(true); }}>Add place</button>
          </div>
          <nav aria-label="Places" class="manage-place-list">
            {places.map((place) => (
              <button class={selected?.id === place.id ? 'active' : ''} onClick={() => choose(place)} key={place.id}>
                <span>{place.name}</span>
                <small>{place.archived ? 'Archived' : `${place.visits.length} visits`}</small>
              </button>
            ))}
          </nav>
        </aside>
        <section>
          {selected ? <PlaceEditor key={selected.id} initial={selected} isNew={isNew} initialCommand={editorCommand} onSaved={saved} onBack={closeEditor} /> : (
            <div class="manage-empty">
              <p class="eyebrow">Ready</p>
              <h2>Choose a place</h2>
              <p>Select an existing place or add a new one. Edits are validated before they touch Firestore.</p>
            </div>
          )}
        </section>
      </div>
      {startingPlace && <StartPlaceModal onClose={() => setStartingPlace(false)} onCreate={(place) => { setEditorCommand(undefined); setPendingPlaceAction(undefined); setSelected(place); setIsNew(true); }} />}
    </main>
  );
}
