import { useEffect, useState } from 'preact/hooks';
import { loadPublicPlace } from '../../data/source';
import { resolveImageSource, type FirestorePlace } from '../../domain/firestore-model';
import { aggregatePlace, formatScore, RATING_CATEGORIES, scoreReview } from '../../domain/ratings';
import type { Review, Visit } from '../../domain/place-schema';
import { LoadState, ScoreBadge, StatusChip } from './PlaceBits';

const base = import.meta.env.BASE_URL;

function ReviewCard({ review }: { review: Review }) {
  return <article class="review-card"><header><div><h4>{review.reviewerName}</h4>{review.notes && <p>{review.notes}</p>}</div><strong>{formatScore(scoreReview(review))}</strong></header><dl class="review-ratings">{RATING_CATEGORIES.flatMap(({ key, label }) => review.ratings[key] === undefined ? [] : <div key={key}><dt>{label}</dt><dd>{review.ratings[key]}</dd></div>)}</dl></article>;
}

function VisitCard({ visit, number }: { visit: Visit; number: number }) {
  const date = new Intl.DateTimeFormat('en-IL', { dateStyle: 'long' }).format(new Date(`${visit.date}T12:00:00`));
  return <article class="visit-card"><header class="visit-card__header"><div><p class="eyebrow">Visit {number}</p><h3>{date}</h3></div><span>{visit.reviews.length} {visit.reviews.length === 1 ? 'reviewer' : 'reviewers'}</span></header>{visit.notes && <p class="visit-note">{visit.notes}</p>}{visit.dishes.length > 0 && <div class="dish-list"><h4>Ordered</h4><ul>{visit.dishes.map((dish, index) => <li key={`${dish.name}-${index}`}><strong>{dish.name}</strong>{dish.notes && <span>{dish.notes}</span>}</li>)}</ul></div>}{visit.photos.length > 0 && <div class="image-gallery visit-photos">{visit.photos.map((image, index) => <figure key={`${image.src}-${index}`}><img src={resolveImageSource(image.src, base)} alt={image.alt} width="900" height="600" loading="lazy" />{image.caption && <figcaption>{image.caption}</figcaption>}</figure>)}</div>}<div class="review-grid">{visit.reviews.map((review) => <ReviewCard review={review} key={review.reviewerId} />)}</div></article>;
}

function PlaceContent({ place }: { place: FirestorePlace }) {
  const aggregate = aggregatePlace(place);
  const visits = [...place.visits].sort((a, b) => b.date.localeCompare(a.date));
  useEffect(() => { document.title = `${place.name} · Ramen Radar`; }, [place.name]);
  return <main>
    <section class="detail-hero shell"><a class="back-link" href={base}>← All places</a><div class="detail-hero__grid"><div class="detail-cover"><img src={resolveImageSource(place.coverImage.src, base)} alt={place.coverImage.alt} width="1100" height="760" />{place.fictional && <span class="fictional-flag">Fictional example · not a real venue</span>}</div><div class="detail-hero__copy"><div class="place-card__eyebrow"><StatusChip status={place.status} /><span>{place.location.city} · {place.priceRange}</span></div><h1>{place.name}</h1>{place.alternateName && <p class="alternate-name">{place.alternateName}</p>}<p class="detail-description">{place.description}</p><div class="tag-list">{[...place.ramenStyles, ...place.tags.filter((tag) => tag !== 'fictional')].map((tag) => <span key={tag}>{tag}</span>)}</div><ScoreBadge score={aggregate.overall} large /></div></div>
      <section class="place-meta" aria-label="Restaurant details"><dl><div><dt>Address</dt><dd>{place.location.address}, {place.location.city}</dd></div><div><dt>Price</dt><dd>{place.priceRange} · {place.currency}</dd></div>{place.openingHoursNote && <div><dt>Hours</dt><dd>{place.openingHoursNote}</dd></div>}{place.dietaryOptions.length > 0 && <div><dt>Dietary</dt><dd>{place.dietaryOptions.join(' · ')}</dd></div>}</dl><div class="action-links"><a href={place.location.mapUrl} target="_blank" rel="noreferrer">Open map ↗</a>{place.links.menu && <a href={place.links.menu} target="_blank" rel="noreferrer">Menu ↗</a>}{place.links.website && <a href={place.links.website} target="_blank" rel="noreferrer">Website ↗</a>}{place.links.reservations && <a href={place.links.reservations} target="_blank" rel="noreferrer">Reservations ↗</a>}{place.links.phone && <a href={`tel:${place.links.phone}`}>Call</a>}</div></section>
    </section>
    <section class="detail-section shell score-section"><div class="section-heading"><p class="eyebrow">Across every visit</p><h2>Category breakdown</h2><p>{aggregate.reviewCount} rated reviewer experiences across {aggregate.ratedVisitCount} visits.</p></div><div class="category-scores">{RATING_CATEGORIES.map(({ key, label }) => <div class="category-score" key={key}><div><span>{label}</span><strong>{formatScore(aggregate.categories[key])}</strong></div><div class="score-track" aria-hidden="true"><span style={{ '--score': aggregate.categories[key] ?? 0 }} /></div></div>)}</div></section>
    {place.gallery.length > 0 && <section class="detail-section shell"><div class="section-heading"><p class="eyebrow">On the table</p><h2>Gallery</h2></div><div class="image-gallery">{place.gallery.map((image, index) => <figure key={`${image.src}-${index}`}><img src={resolveImageSource(image.src, base)} alt={image.alt} width="900" height="600" loading="lazy" />{image.caption && <figcaption>{image.caption}</figcaption>}</figure>)}</div></section>}
    <section class="detail-section shell" aria-labelledby="visits-heading"><div class="section-heading"><p class="eyebrow">The history</p><h2 id="visits-heading">Visit log</h2></div>{visits.length > 0 ? <div class="visit-list">{visits.map((visit, index) => <VisitCard visit={visit} number={visits.length - index} key={visit.id} />)}</div> : <div class="empty-state"><span aria-hidden="true">⌁</span><h3>Still on the wish list</h3><p>Add the first visit to begin ranking this place.</p></div>}</section>
  </main>;
}

export default function PlaceDetailApp() {
  const [place, setPlace] = useState<FirestorePlace | null | undefined>();
  const [error, setError] = useState('');
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('id');
    if (!id) { setPlace(null); return; }
    void loadPublicPlace(id).then(setPlace).catch(() => setError('This place could not be loaded. Check your connection and try again.'));
  }, []);
  if (error) return <LoadState><h1>Unable to load place</h1><p>{error}</p><a href={base}>Back to all places</a></LoadState>;
  if (place === undefined) return <LoadState><p>Loading place…</p></LoadState>;
  if (place === null) return <LoadState><h1>Place not found</h1><p>This place may have been archived or the link may be incorrect.</p><a href={base}>Back to all places</a></LoadState>;
  return <PlaceContent place={place} />;
}
