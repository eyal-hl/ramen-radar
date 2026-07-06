import type { User } from 'firebase/auth';
import { useEffect, useState } from 'preact/hooks';
import { seedPlaces } from '../../data/seed';
import { parsePlaceDocument, type FirestorePlace } from '../../domain/firestore-model';
import { ratingKeys, type RatingKey, type Review, type Visit } from '../../domain/place-schema';
import { observeUser, signInWithGoogle, signOutUser } from '../../firebase/auth';
import { isApprovedEditor, listEditorPlaces, savePlace } from '../../firebase/places';
import { LoadState } from './PlaceBits';

const fixtureMode = import.meta.env.PUBLIC_DATA_MODE === 'fixture';
const today = () => new Date().toISOString().slice(0, 10);
const slugify = (value: string) => value.toLocaleLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const csv = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);

function newPlace(): FirestorePlace {
  return parsePlaceDocument({ id: 'new-place', fictional: false, name: 'New place', description: 'Add a short factual description.', status: 'want-to-visit', addedAt: today(), location: { address: 'Address', city: 'Givatayim', latitude: 32.07, longitude: 34.81, mapUrl: 'https://maps.google.com/' }, links: {}, priceRange: '$$', currency: 'ILS', ramenStyles: [], dietaryOptions: [], tags: [], coverImage: { src: '/images/places/unvisited/placeholder.svg', alt: 'Placeholder ramen bowl' }, gallery: [], visits: [], archived: false });
}

const newReview = (): Review => ({ reviewerId: 'reviewer', reviewerName: 'Reviewer', ratings: {} });
const newVisit = (): Visit => ({ id: `visit-${today()}`, date: today(), photos: [], dishes: [], reviews: [newReview()] });

function TextField({ label, value, onInput, required = false, type = 'text', readOnly = false, step }: { label: string; value: string | number; onInput: (value: string) => void; required?: boolean; type?: string; readOnly?: boolean; step?: string }) {
  return <label><span>{label}</span><input type={type} value={value} required={required} readOnly={readOnly} step={step} onInput={(event) => onInput(event.currentTarget.value)} /></label>;
}

function ReviewEditor({ review, onChange, onRemove }: { review: Review; onChange: (review: Review) => void; onRemove: () => void }) {
  const rating = (key: RatingKey, value: string) => {
    const ratings = { ...review.ratings };
    if (value === '') delete ratings[key]; else ratings[key] = Number(value);
    onChange({ ...review, ratings });
  };
  return <section class="manage-nested"><div class="manage-grid"><TextField label="Reviewer ID" value={review.reviewerId} required onInput={(reviewerId) => onChange({ ...review, reviewerId: slugify(reviewerId) })} /><TextField label="Reviewer name" value={review.reviewerName} required onInput={(reviewerName) => onChange({ ...review, reviewerName })} /><TextField label="Review notes" value={review.notes ?? ''} onInput={(notes) => onChange({ ...review, notes: notes || undefined })} /></div><div class="rating-editor">{ratingKeys.map((key) => <label key={key}><span>{key === 'wouldReturn' ? 'Would return' : key}</span><input type="number" min="1" max="10" step="1" value={review.ratings[key] ?? ''} onInput={(event) => rating(key, event.currentTarget.value)} /></label>)}</div><button type="button" class="text-button danger" onClick={onRemove}>Remove reviewer</button></section>;
}

function VisitEditor({ visit, number, onChange, onRemove }: { visit: Visit; number: number; onChange: (visit: Visit) => void; onRemove: () => void }) {
  const changeReview = (index: number, review: Review) => onChange({ ...visit, reviews: visit.reviews.map((item, i) => i === index ? review : item) });
  const dishes = (value: string) => csv(value).map((dish) => {
    const [name, notes] = dish.split('|').map((part) => part.trim());
    return { name, ...(notes ? { notes } : {}) };
  });
  const photos = (value: string) => csv(value).map((entry) => {
    const [src, alt, caption] = entry.split('|').map((part) => part.trim());
    return { src, alt, ...(caption ? { caption } : {}) };
  });
  return <fieldset class="manage-visit"><legend>Visit {number}</legend><div class="manage-grid"><TextField label="Visit ID" value={visit.id} required onInput={(id) => onChange({ ...visit, id: slugify(id) })} /><TextField label="Date" value={visit.date} type="date" required onInput={(date) => onChange({ ...visit, date })} /><TextField label="Visit notes" value={visit.notes ?? ''} onInput={(notes) => onChange({ ...visit, notes: notes || undefined })} /><TextField label="Dishes (name | notes, comma-separated)" value={visit.dishes.map(({ name, notes }) => `${name}${notes ? ` | ${notes}` : ''}`).join(', ')} onInput={(value) => onChange({ ...visit, dishes: dishes(value) })} /><TextField label="Visit photos (URL | alt | caption, comma-separated)" value={visit.photos.map(({ src, alt, caption }) => `${src} | ${alt}${caption ? ` | ${caption}` : ''}`).join(', ')} onInput={(value) => onChange({ ...visit, photos: photos(value) })} /></div><div class="manage-section-heading"><h4>Reviews</h4><button type="button" onClick={() => onChange({ ...visit, reviews: [...visit.reviews, newReview()] })}>Add reviewer</button></div>{visit.reviews.map((review, index) => <ReviewEditor key={`${review.reviewerId}-${index}`} review={review} onChange={(value) => changeReview(index, value)} onRemove={() => onChange({ ...visit, reviews: visit.reviews.filter((_, i) => i !== index) })} />)}<button type="button" class="text-button danger" onClick={onRemove}>Remove visit</button></fieldset>;
}

function PlaceEditor({ initial, isNew, onSaved }: { initial: FirestorePlace; isNew: boolean; onSaved: (place: FirestorePlace) => void }) {
  const [place, setPlace] = useState(initial);
  const [message, setMessage] = useState('');
  const set = <K extends keyof FirestorePlace>(key: K, value: FirestorePlace[K]) => setPlace((current) => ({ ...current, [key]: value }));
  const save = async (event: Event) => {
    event.preventDefault(); setMessage('Saving…');
    try {
      const validated = parsePlaceDocument(place);
      const saved = fixtureMode ? { ...validated, updatedAt: new Date().toISOString() } : await savePlace(validated, initial.updatedAt);
      setPlace(saved); onSaved(saved); setMessage('Saved. Public pages will show this version when refreshed.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The place could not be saved.');
    }
  };
  const updateVisit = (index: number, visit: Visit) => set('visits', place.visits.map((item, i) => i === index ? visit : item));
  return <form class="manage-editor" onSubmit={save}><div class="manage-editor__header"><div><p class="eyebrow">{isNew ? 'Create place' : 'Edit place'}</p><h2>{place.name}</h2></div><button class="manage-primary" type="submit">Save place</button></div>{message && <p class="manage-message" aria-live="polite">{message}</p>}
    <fieldset><legend>Place details</legend><div class="manage-grid"><TextField label="ID" value={place.id} required readOnly={!isNew} onInput={(id) => set('id', slugify(id))} /><TextField label="Name" value={place.name} required onInput={(name) => set('name', name)} /><TextField label="Alternate name" value={place.alternateName ?? ''} onInput={(alternateName) => set('alternateName', alternateName || undefined)} /><TextField label="Description" value={place.description} required onInput={(description) => set('description', description)} /><label><span>Status</span><select value={place.status} onChange={(event) => set('status', event.currentTarget.value as FirestorePlace['status'])}><option value="want-to-visit">Want to visit</option><option value="visited">Visited</option><option value="unavailable">Unavailable</option></select></label><TextField label="Added date" value={place.addedAt} type="date" required onInput={(addedAt) => set('addedAt', addedAt)} /><label class="manage-check"><input type="checkbox" checked={place.fictional} onChange={(event) => set('fictional', event.currentTarget.checked)} /> Fictional example</label><label class="manage-check"><input type="checkbox" checked={place.archived} onChange={(event) => set('archived', event.currentTarget.checked)} /> Archived (hidden publicly)</label></div></fieldset>
    <fieldset><legend>Location and links</legend><div class="manage-grid"><TextField label="Address" value={place.location.address} required onInput={(address) => set('location', { ...place.location, address })} /><TextField label="City" value={place.location.city} required onInput={(city) => set('location', { ...place.location, city })} /><TextField label="Latitude" value={place.location.latitude} type="number" step="any" required onInput={(latitude) => set('location', { ...place.location, latitude: Number(latitude) })} /><TextField label="Longitude" value={place.location.longitude} type="number" step="any" required onInput={(longitude) => set('location', { ...place.location, longitude: Number(longitude) })} /><TextField label="Google Maps URL" value={place.location.mapUrl} type="url" required onInput={(mapUrl) => set('location', { ...place.location, mapUrl })} /><TextField label="Website URL" value={place.links.website ?? ''} type="url" onInput={(website) => set('links', { ...place.links, website: website || undefined })} /><TextField label="Menu URL" value={place.links.menu ?? ''} type="url" onInput={(menu) => set('links', { ...place.links, menu: menu || undefined })} /><TextField label="Reservations URL" value={place.links.reservations ?? ''} type="url" onInput={(reservations) => set('links', { ...place.links, reservations: reservations || undefined })} /><TextField label="Phone" value={place.links.phone ?? ''} onInput={(phone) => set('links', { ...place.links, phone: phone || undefined })} /></div></fieldset>
    <fieldset><legend>Classification</legend><div class="manage-grid"><label><span>Price range</span><select value={place.priceRange} onChange={(event) => set('priceRange', event.currentTarget.value as FirestorePlace['priceRange'])}>{['$', '$$', '$$$', '$$$$'].map((price) => <option key={price}>{price}</option>)}</select></label><TextField label="Currency" value={place.currency} required onInput={(currency) => set('currency', currency.toUpperCase())} /><TextField label="Ramen styles (comma-separated)" value={place.ramenStyles.join(', ')} onInput={(value) => set('ramenStyles', csv(value))} /><TextField label="Dietary options (comma-separated)" value={place.dietaryOptions.join(', ')} onInput={(value) => set('dietaryOptions', csv(value))} /><TextField label="Tags (comma-separated)" value={place.tags.join(', ')} onInput={(value) => set('tags', csv(value))} /><TextField label="Opening-hours note" value={place.openingHoursNote ?? ''} onInput={(openingHoursNote) => set('openingHoursNote', openingHoursNote || undefined)} /></div></fieldset>
    <fieldset><legend>Images</legend><div class="manage-grid"><TextField label="Cover image URL/path" value={place.coverImage.src} required onInput={(src) => set('coverImage', { ...place.coverImage, src })} /><TextField label="Cover alt text" value={place.coverImage.alt} required onInput={(alt) => set('coverImage', { ...place.coverImage, alt })} /><TextField label="Cover caption" value={place.coverImage.caption ?? ''} onInput={(caption) => set('coverImage', { ...place.coverImage, caption: caption || undefined })} /><TextField label="Gallery (URL | alt | caption, comma-separated)" value={place.gallery.map(({ src, alt, caption }) => `${src} | ${alt}${caption ? ` | ${caption}` : ''}`).join(', ')} onInput={(value) => set('gallery', csv(value).map((entry) => { const [src, alt, caption] = entry.split('|').map((part) => part.trim()); return { src, alt, ...(caption ? { caption } : {}) }; }))} /></div></fieldset>
    <div class="manage-section-heading"><h3>Visits</h3><button type="button" onClick={() => set('visits', [...place.visits, newVisit()])}>Add visit</button></div>{place.visits.map((visit, index) => <VisitEditor key={`${visit.id}-${index}`} visit={visit} number={index + 1} onChange={(value) => updateVisit(index, value)} onRemove={() => set('visits', place.visits.filter((_, i) => i !== index))} />)}
  </form>;
}

export default function ManageApp() {
  const [user, setUser] = useState<User | null | undefined>(fixtureMode ? ({ uid: 'fixture-editor', displayName: 'Fixture Editor' } as User) : undefined);
  const [approved, setApproved] = useState<boolean | undefined>(fixtureMode ? true : undefined);
  const [places, setPlaces] = useState<FirestorePlace[]>(fixtureMode ? seedPlaces : []);
  const [selected, setSelected] = useState<FirestorePlace>();
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => fixtureMode ? undefined : observeUser((nextUser) => { setUser(nextUser); setApproved(undefined); }), []);
  useEffect(() => {
    if (!user) { setApproved(false); return; }
    if (fixtureMode) return;
    void isApprovedEditor(user.uid).then((allowed) => { setApproved(allowed); if (allowed) void listEditorPlaces().then(setPlaces); }).catch(() => setError('Editor access could not be checked.'));
  }, [user]);

  if (error) return <LoadState><h1>Manage Ramen Radar</h1><p>{error}</p></LoadState>;
  if (user === undefined || (user && approved === undefined)) return <LoadState><p>Checking editor access…</p></LoadState>;
  if (!user) return <LoadState><h1>Manage Ramen Radar</h1><p>Sign in with an approved Google account to add places and reviews.</p><button class="manage-primary" onClick={() => void signInWithGoogle().catch(() => setError('Google sign-in did not complete.'))}>Sign in with Google</button></LoadState>;
  if (!approved) return <LoadState><h1>Access pending</h1><p>You signed in successfully, but this account is not in the editor allowlist. Ask the project owner to add UID <code>{user.uid}</code> to the <code>editors</code> collection.</p><button onClick={() => void signOutUser()}>Sign out</button></LoadState>;

  const choose = (place: FirestorePlace) => { setNotice(''); setSelected(place); setIsNew(false); };
  const saved = (place: FirestorePlace) => { setPlaces((current) => [...current.filter(({ id }) => id !== place.id), place].sort((a, b) => a.name.localeCompare(b.name))); setSelected(place); setIsNew(false); setNotice('Saved. Public pages will show this version when refreshed.'); };
  const importSeed = async () => {
    try {
      for (const place of seedPlaces) await savePlace(place, undefined);
      setPlaces(await listEditorPlaces());
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Import failed.'); }
  };
  return <main class="manage-shell shell"><header class="manage-top"><div><p class="eyebrow">Private editor</p><h1>Manage Ramen Radar</h1><p>Signed in as {user.email ?? user.displayName ?? user.uid}</p></div>{!fixtureMode && <button onClick={() => void signOutUser()}>Sign out</button>}</header>{notice && <p class="manage-message" aria-live="polite">{notice}</p>}<div class="manage-layout"><aside class="manage-sidebar"><button class="manage-primary" onClick={() => { setNotice(''); setSelected(newPlace()); setIsNew(true); }}>Add place</button>{places.length === 0 && <button onClick={() => void importSeed()}>Import existing JSON places</button>}<nav aria-label="Places">{places.map((place) => <button class={selected?.id === place.id ? 'active' : ''} onClick={() => choose(place)} key={place.id}><span>{place.name}</span>{place.archived && <small>Archived</small>}</button>)}</nav></aside><section>{selected ? <PlaceEditor key={selected.id} initial={selected} isNew={isNew} onSaved={saved} /> : <div class="manage-empty"><h2>Choose a place</h2><p>Select an existing place or add a new one.</p></div>}</section></div></main>;
}
