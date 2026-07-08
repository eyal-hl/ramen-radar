import type { ComponentChildren } from 'preact';
import type { User } from 'firebase/auth';
import { useEffect, useState } from 'preact/hooks';
import { parsePlaceDocument, type FirestorePlace } from '../../domain/firestore-model';
import { parseGoogleMapsUrl } from '../../domain/google-maps';
import { RATING_CATEGORIES, formatScore, scoreReview } from '../../domain/ratings';
import { type RatingKey, type Review, type Visit } from '../../domain/place-schema';
import { observeUser, signInWithGoogle, signOutUser } from '../../firebase/auth';
import { isApprovedEditor, listEditorPlaces, savePlace } from '../../firebase/places';
import { LoadState } from './PlaceBits';

const today = () => new Date().toISOString().slice(0, 10);
const slugify = (value: string) => value.toLocaleLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const csv = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
const placeholderImage = '/images/places/unvisited/placeholder.svg';

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

const newReview = (): Review => ({ reviewerId: 'reviewer', reviewerName: 'Reviewer', ratings: {} });
const newVisit = (): Visit => ({ id: `visit-${today()}`, date: today(), photos: [], dishes: [], reviews: [newReview()] });

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

function Modal({ title, eyebrow, children, onClose }: { title: string; eyebrow: string; children: ComponentChildren; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('modal-open');
    };
  }, [onClose]);

  return (
    <div class="manage-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section class="manage-modal" role="dialog" aria-modal="true" aria-labelledby="manage-modal-title">
        <header class="manage-modal__header">
          <div>
            <p class="eyebrow">{eyebrow}</p>
            <h2 id="manage-modal-title">{title}</h2>
          </div>
          <button type="button" class="manage-secondary" onClick={onClose}>Close</button>
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
      <form class="manage-modal-form" onSubmit={create}>
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

function ReviewModal({ onAdd, onClose }: { onAdd: (review: Review) => void; onClose: () => void }) {
  const [review, setReview] = useState(newReview());
  const submit = (event: Event) => {
    event.preventDefault();
    onAdd(review);
    onClose();
  };
  return (
    <Modal eyebrow="New review" title="Add reviewer notes" onClose={onClose}>
      <form class="manage-modal-form" onSubmit={submit}>
        <ReviewEditor review={review} onChange={setReview} onRemove={onClose} />
        <div class="manage-modal-actions">
          <button type="button" class="manage-secondary" onClick={onClose}>Cancel</button>
          <button class="manage-primary" type="submit">Add review</button>
        </div>
      </form>
    </Modal>
  );
}

function VisitEditor({ visit, number, onChange, onRemove }: { visit: Visit; number: number; onChange: (visit: Visit) => void; onRemove: () => void }) {
  const [addingReview, setAddingReview] = useState(false);
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
        <button type="button" class="manage-secondary" onClick={() => setAddingReview(true)}>Add reviewer</button>
      </div>
      <div class="review-editor-list">
        {visit.reviews.map((review, index) => (
          <ReviewEditor key={`${review.reviewerId}-${index}`} review={review} onChange={(value) => changeReview(index, value)} onRemove={() => onChange({ ...visit, reviews: visit.reviews.filter((_, i) => i !== index) })} />
        ))}
      </div>
      {addingReview && <ReviewModal onClose={() => setAddingReview(false)} onAdd={(review) => onChange({ ...visit, reviews: [...visit.reviews, review] })} />}
    </section>
  );
}

function PlaceEditor({ initial, isNew, onSaved }: { initial: FirestorePlace; isNew: boolean; onSaved: (place: FirestorePlace) => void }) {
  const [place, setPlace] = useState(initial);
  const [message, setMessage] = useState('');
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

  const save = async (event: Event) => {
    event.preventDefault();
    setMessage('Saving…');
    try {
      const validated = parsePlaceDocument(place);
      const saved = await savePlace(validated, initial.updatedAt);
      setPlace(saved);
      onSaved(saved);
      setMessage('Saved. Public pages will show this version when refreshed.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The place could not be saved.');
    }
  };

  return (
    <form class="manage-editor" onSubmit={save}>
      <div class="manage-editor-hero">
        <div>
          <p class="eyebrow">{isNew ? 'Create place' : 'Edit place'}</p>
          <h2>{place.name}</h2>
          <p>{place.location.city} · {place.status.replaceAll('-', ' ')} · {place.visits.length} {place.visits.length === 1 ? 'visit' : 'visits'}</p>
        </div>
        <button class="manage-primary" type="submit">Save place</button>
      </div>
      {message && <p class="manage-message" aria-live="polite">{message}</p>}

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

      <SectionCard eyebrow="Images" title="Cover and gallery">
        <div class="manage-grid">
          <Field label="Cover image URL/path" value={place.coverImage.src} required help="Use /images/places/... or an HTTPS URL." onInput={(src) => set('coverImage', { ...place.coverImage, src })} />
          <Field label="Cover alt text" value={place.coverImage.alt} required onInput={(alt) => set('coverImage', { ...place.coverImage, alt })} />
          <Field label="Cover caption" value={place.coverImage.caption ?? ''} onInput={(caption) => set('coverImage', { ...place.coverImage, caption: caption || undefined })} />
          <Field label="Gallery" value={place.gallery.map(({ src, alt, caption }) => `${src} | ${alt}${caption ? ` | ${caption}` : ''}`).join(', ')} multiline help="Format: URL/path | alt | caption, comma-separated." onInput={(value) => set('gallery', csv(value).map((entry) => { const [src, alt, caption] = entry.split('|').map((part) => part.trim()); return { src, alt, ...(caption ? { caption } : {}) }; }))} />
        </div>
      </SectionCard>

      <SectionCard eyebrow="Visits" title="Visit log" action={<button type="button" class="manage-secondary" onClick={() => set('visits', [...place.visits, newVisit()])}>Add visit</button>}>
        {place.visits.length > 0 ? (
          <div class="visit-editor-list">
            {place.visits.map((visit, index) => <VisitEditor key={`${visit.id}-${index}`} visit={visit} number={index + 1} onChange={(value) => updateVisit(index, value)} onRemove={() => set('visits', place.visits.filter((_, i) => i !== index))} />)}
          </div>
        ) : (
          <div class="manage-empty compact">
            <h4>No visits yet</h4>
            <p>Add a visit when somebody actually tries the ramen.</p>
          </div>
        )}
      </SectionCard>
    </form>
  );
}

export default function ManageApp() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [approved, setApproved] = useState<boolean | undefined>(undefined);
  const [places, setPlaces] = useState<FirestorePlace[]>([]);
  const [selected, setSelected] = useState<FirestorePlace>();
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [startingPlace, setStartingPlace] = useState(false);

  useEffect(() => observeUser((nextUser) => { setUser(nextUser); setApproved(undefined); }), []);
  useEffect(() => {
    if (!user) {
      setApproved(false);
      return;
    }
    void isApprovedEditor(user.uid)
      .then((allowed) => { setApproved(allowed); if (allowed) void listEditorPlaces().then(setPlaces); })
      .catch(() => setError('Editor access could not be checked.'));
  }, [user]);

  if (error) return <LoadState><h1>Manage Ramen Radar</h1><p>{error}</p></LoadState>;
  if (user === undefined || (user && approved === undefined)) return <LoadState><p>Checking editor access…</p></LoadState>;
  if (!user) return <LoadState><h1>Manage Ramen Radar</h1><p>Sign in with an approved Google account to add places and reviews.</p><button class="manage-primary" onClick={() => void signInWithGoogle().catch((reason) => setError(signInErrorMessage(reason)))}>Sign in with Google</button></LoadState>;
  if (!approved) return <LoadState><h1>Access pending</h1><p>You signed in successfully, but this account is not in the editor allowlist. Ask the project owner to add UID <code>{user.uid}</code> to the <code>editors</code> collection.</p><button onClick={() => void signOutUser()}>Sign out</button></LoadState>;

  const choose = (place: FirestorePlace) => { setNotice(''); setSelected(place); setIsNew(false); };
  const saved = (place: FirestorePlace) => {
    setPlaces((current) => [...current.filter(({ id }) => id !== place.id), place].sort((a, b) => a.name.localeCompare(b.name)));
    setSelected(place);
    setIsNew(false);
    setNotice('Saved. Public pages will show this version when refreshed.');
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

      <div class="manage-layout">
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
          {selected ? <PlaceEditor key={selected.id} initial={selected} isNew={isNew} onSaved={saved} /> : (
            <div class="manage-empty">
              <p class="eyebrow">Ready</p>
              <h2>Choose a place</h2>
              <p>Select an existing place or add a new one. Edits are validated before they touch Firestore.</p>
            </div>
          )}
        </section>
      </div>
      {startingPlace && <StartPlaceModal onClose={() => setStartingPlace(false)} onCreate={(place) => { setSelected(place); setIsNew(true); }} />}
    </main>
  );
}
