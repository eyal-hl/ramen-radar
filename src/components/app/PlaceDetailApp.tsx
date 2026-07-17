import { useEffect, useState } from 'preact/hooks';
import { loadPublicPlace } from '../../data/source';
import { resolveImageSource, type FirestorePlace } from '../../domain/firestore-model';
import {
  aggregatePlace,
  aggregateVisit,
  formatScore,
  RATING_CATEGORIES,
  scoreReview,
} from '../../domain/ratings';
import type { Review, Visit } from '../../domain/place-schema';
import { joinBase } from '../../domain/urls';
import { PlaceActionDock } from './MobileShell';
import { LoadState, ScoreBadge, StatusChip } from './PlaceBits';

const base = import.meta.env.BASE_URL;
type DetailTab = 'overview' | 'visits';

function formatVisitDate(value: string): string {
  return new Intl.DateTimeFormat('en-IL', { dateStyle: 'long' })
    .format(new Date(`${value}T12:00:00`));
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <article class="review-card">
      <header>
        <div>
          <h4>{review.reviewerName}</h4>
          {review.notes && <p>{review.notes}</p>}
        </div>
        <strong>{formatScore(scoreReview(review))}</strong>
      </header>
      <dl class="review-ratings">
        {RATING_CATEGORIES.flatMap(({ key, label }) => review.ratings[key] === undefined ? [] : (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{review.ratings[key]}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function VisitCard({ visit, number, basePath }: { visit: Visit; number: number; basePath: string }) {
  const score = aggregateVisit(visit).overall;
  const reviewerLabel = `${visit.reviews.length} ${visit.reviews.length === 1 ? 'reviewer' : 'reviewers'}`;

  return (
    <article class="visit-card">
      <header class="visit-card__header">
        <div>
          <p class="eyebrow">Visit {number}</p>
          <h3>{formatVisitDate(visit.date)}</h3>
        </div>
        <span>{reviewerLabel}{score === null ? '' : ` · ${formatScore(score)}`}</span>
      </header>
      {visit.notes && <p class="visit-note">{visit.notes}</p>}
      {visit.dishes.length > 0 && (
        <div class="dish-list">
          <h4>Ordered</h4>
          <ul>
            {visit.dishes.map((dish, index) => (
              <li key={`${dish.name}-${index}`}>
                <strong>{dish.name}</strong>
                {dish.notes && <span>{dish.notes}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {visit.photos.length > 0 && (
        <div class="image-gallery visit-photos">
          {visit.photos.map((image, index) => (
            <figure key={`${image.src}-${index}`}>
              <img
                src={resolveImageSource(image.src, basePath)}
                alt={image.alt}
                width="900"
                height="600"
                loading="lazy"
              />
              {image.caption && <figcaption>{image.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}
      <div class="review-grid">
        {visit.reviews.map((review) => <ReviewCard review={review} key={review.reviewerId} />)}
      </div>
    </article>
  );
}

export function PlaceContent({
  place,
  base: basePath = base,
}: {
  place: FirestorePlace;
  base?: string;
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const aggregate = aggregatePlace(place);
  const visits = [...place.visits].sort((a, b) => b.date.localeCompare(a.date));
  const latestVisit = visits[0];
  const bestCategory = RATING_CATEGORIES.reduce<{ label: string; score: number } | null>(
    (best, { key, label }) => {
      const score = aggregate.categories[key];
      return score !== null && (best === null || score > best.score) ? { label, score } : best;
    },
    null,
  );
  const overviewTabId = `place-overview-tab-${place.id}`;
  const visitsTabId = `place-visits-tab-${place.id}`;
  const overviewPanelId = `place-overview-panel-${place.id}`;
  const visitsPanelId = `place-visits-panel-${place.id}`;

  useEffect(() => { document.title = `${place.name} · Ramen Radar`; }, [place.name]);

  const selectTab = (tab: DetailTab, focus = false) => {
    setActiveTab(tab);
    if (focus) {
      const id = tab === 'overview' ? overviewTabId : visitsTabId;
      requestAnimationFrame(() => document.getElementById(id)?.focus());
    }
  };
  const onTabKeyDown = (event: KeyboardEvent, current: DetailTab) => {
    let next: DetailTab | undefined;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      next = current === 'overview' ? 'visits' : 'overview';
    } else if (event.key === 'Home') {
      next = 'overview';
    } else if (event.key === 'End') {
      next = 'visits';
    }
    if (!next) return;
    event.preventDefault();
    selectTab(next, true);
  };

  return (
    <main class="detail-page">
      <section class="detail-hero detail-hero--compact shell">
        <a class="back-link" href={joinBase(basePath, '')}>← Radar</a>
        <div class="detail-hero__grid">
          <div class="detail-cover">
            <img
              src={resolveImageSource(place.coverImage.src, basePath)}
              alt={place.coverImage.alt}
              width="1100"
              height="760"
            />
            {place.fictional && <span class="fictional-flag">Fictional example · not a real venue</span>}
          </div>
          <div class="detail-hero__copy detail-hero__copy--compact">
            <div class="place-card__eyebrow">
              <StatusChip status={place.status} />
              <span>
                {place.location.city} · {place.priceRange}
                {place.ramenStyles[0] ? ` · ${place.ramenStyles[0]}` : ''}
              </span>
            </div>
            <h1>{place.name}</h1>
            {place.alternateName && <p class="alternate-name">{place.alternateName}</p>}
            <ScoreBadge score={aggregate.overall} />
          </div>
        </div>
      </section>

      <div class="detail-tab-shell shell">
        <div class="detail-tabs" role="tablist" aria-label={`${place.name} details`}>
          <button
            id={overviewTabId}
            class="detail-tab"
            type="button"
            role="tab"
            aria-selected={activeTab === 'overview'}
            aria-controls={overviewPanelId}
            tabIndex={activeTab === 'overview' ? 0 : -1}
            onClick={() => selectTab('overview')}
            onKeyDown={(event) => onTabKeyDown(event, 'overview')}
          >
            Overview
          </button>
          <button
            id={visitsTabId}
            class="detail-tab"
            type="button"
            role="tab"
            aria-selected={activeTab === 'visits'}
            aria-controls={visitsPanelId}
            tabIndex={activeTab === 'visits' ? 0 : -1}
            onClick={() => selectTab('visits')}
            onKeyDown={(event) => onTabKeyDown(event, 'visits')}
          >
            Visits {visits.length}
          </button>
        </div>
      </div>

      <div
        id={overviewPanelId}
        class="detail-tab-panel detail-overview"
        role="tabpanel"
        aria-labelledby={overviewTabId}
        hidden={activeTab !== 'overview'}
      >
        <section class="detail-section detail-overview__intro shell">
          <p class="detail-description">{place.description}</p>
          <div class="tag-list">
            {[...place.ramenStyles, ...place.tags.filter((tag) => tag !== 'fictional')]
              .map((tag) => <span key={tag}>{tag}</span>)}
          </div>
          <dl class="detail-facts">
            <div>
              <dt>Latest visit</dt>
              <dd>{latestVisit ? formatVisitDate(latestVisit.date) : 'Not visited yet'}</dd>
            </div>
            <div>
              <dt>Would return</dt>
              <dd>{formatScore(aggregate.categories.wouldReturn)}</dd>
            </div>
            <div>
              <dt>Best category</dt>
              <dd>{bestCategory ? `${bestCategory.label} ${formatScore(bestCategory.score)}` : 'Not rated yet'}</dd>
            </div>
          </dl>

          <section class="place-meta" aria-label="Restaurant details">
            <dl>
              <div><dt>Address</dt><dd>{place.location.address}, {place.location.city}</dd></div>
              <div><dt>Price</dt><dd>{place.priceRange} · {place.currency}</dd></div>
              {place.openingHoursNote && <div><dt>Hours</dt><dd>{place.openingHoursNote}</dd></div>}
              {place.dietaryOptions.length > 0 && (
                <div><dt>Dietary</dt><dd>{place.dietaryOptions.join(' · ')}</dd></div>
              )}
            </dl>
            <div class="action-links">
              <a href={place.location.mapUrl} target="_blank" rel="noreferrer">Directions ↗</a>
              {place.links.menu && <a href={place.links.menu} target="_blank" rel="noreferrer">Menu ↗</a>}
              {place.links.website && <a href={place.links.website} target="_blank" rel="noreferrer">Website ↗</a>}
              {place.links.reservations && <a href={place.links.reservations} target="_blank" rel="noreferrer">Reservations ↗</a>}
              {place.links.phone && <a href={`tel:${place.links.phone}`}>Call</a>}
            </div>
          </section>
        </section>

        <section class="detail-section shell score-section">
          <div class="section-heading">
            <p class="eyebrow">Across every visit</p>
            <h2>Category breakdown</h2>
            <p>{aggregate.reviewCount} rated reviewer experiences across {aggregate.ratedVisitCount} visits.</p>
          </div>
          <div class="category-scores">
            {RATING_CATEGORIES.map(({ key, label }) => (
              <div class="category-score" key={key}>
                <div><span>{label}</span><strong>{formatScore(aggregate.categories[key])}</strong></div>
                <div class="score-track" aria-hidden="true">
                  <span style={{ '--score': aggregate.categories[key] ?? 0 }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {place.gallery.length > 0 && (
          <section class="detail-section shell">
            <div class="section-heading"><p class="eyebrow">On the table</p><h2>Gallery</h2></div>
            <div class="image-gallery">
              {place.gallery.map((image, index) => (
                <figure key={`${image.src}-${index}`}>
                  <img
                    src={resolveImageSource(image.src, basePath)}
                    alt={image.alt}
                    width="900"
                    height="600"
                    loading="lazy"
                  />
                  {image.caption && <figcaption>{image.caption}</figcaption>}
                </figure>
              ))}
            </div>
          </section>
        )}
      </div>

      <section
        id={visitsPanelId}
        class="detail-tab-panel detail-section shell"
        role="tabpanel"
        aria-labelledby={visitsTabId}
        hidden={activeTab !== 'visits'}
      >
        <div class="section-heading">
          <p class="eyebrow">The history</p>
          <h2>Visit log</h2>
        </div>
        {visits.length > 0 ? (
          <div class="visit-list">
            {visits.map((visit, index) => (
              <VisitCard visit={visit} number={visits.length - index} basePath={basePath} key={visit.id} />
            ))}
          </div>
        ) : (
          <div class="empty-state">
            <span aria-hidden="true">⌁</span>
            <h3>Still on the wish list</h3>
            <p>Add the first visit to begin ranking this place.</p>
          </div>
        )}
      </section>

      <PlaceActionDock
        base={basePath}
        placeId={place.id}
        mapUrl={place.location.mapUrl}
        menuUrl={place.links.menu}
      />
    </main>
  );
}

export default function PlaceDetailApp() {
  const [place, setPlace] = useState<FirestorePlace | null | undefined>();
  const [error, setError] = useState('');

  useEffect(() => {
    const id = new URLSearchParams(location.search).get('id');
    if (!id) {
      setPlace(null);
      return;
    }
    void loadPublicPlace(id)
      .then(setPlace)
      .catch(() => setError('This place could not be loaded. Check your connection and try again.'));
  }, []);

  const homeUrl = joinBase(base, '');
  if (error) return <LoadState><h1>Unable to load place</h1><p>{error}</p><a href={homeUrl}>Back to all places</a></LoadState>;
  if (place === undefined) return <LoadState><p>Loading place…</p></LoadState>;
  if (place === null) return <LoadState><h1>Place not found</h1><p>This place may have been archived or the link may be incorrect.</p><a href={homeUrl}>Back to all places</a></LoadState>;
  return <PlaceContent place={place} />;
}
