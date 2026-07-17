import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { matchesDirectoryFilters, type DirectoryFilters } from '../../domain/directory';
import { resolveImageSource, type FirestorePlace } from '../../domain/firestore-model';
import { toJournalEntries, type JournalEntry } from '../../domain/journal';
import { toMapPlace } from '../../domain/map';
import { sortPlaceCards, toPlaceCard, type SortMode } from '../../domain/places';
import { placeDetailUrl, type DirectoryView } from '../../domain/urls';
import { loadPublicPlaces } from '../../data/source';
import type { MapController } from '../../scripts/map-view';
import { LoadState, ScoreBadge, StatusChip } from './PlaceBits';
import { MobilePrimaryNav, QuickAddSheet } from './MobileShell';

const base = import.meta.env.BASE_URL;
const emptyFilters: DirectoryFilters = { query: '', status: '', city: '', style: '', diet: '', price: '', minimumScore: 0 };

function initialFilters(): DirectoryFilters {
  if (typeof location === 'undefined') return emptyFilters;
  const params = new URLSearchParams(location.search);
  return {
    query: params.get('query') ?? '', status: params.get('status') ?? '', city: params.get('city') ?? '',
    style: params.get('style') ?? '', diet: params.get('diet') ?? '', price: params.get('price') ?? '',
    minimumScore: Number(params.get('minimumScore') ?? 0),
  };
}

function initialView(): DirectoryView {
  if (typeof location === 'undefined') return 'list';
  const value = new URLSearchParams(location.search).get('view');
  return value === 'map' || value === 'journal' ? value : 'list';
}

function DirectoryMap({ places, visibleIds }: { places: ReturnType<typeof toMapPlace>[]; visibleIds: string[] }) {
  const element = useRef<HTMLDivElement>(null);
  const controller = useRef<MapController>();
  useEffect(() => {
    let active = true;
    void import('../../scripts/map-view').then(({ initializeDirectoryMap }) => {
      if (!active || !element.current) return;
      controller.current = initializeDirectoryMap(places, element.current);
      controller.current.sync(visibleIds);
      controller.current.resize();
    });
    return () => { active = false; controller.current?.destroy(); controller.current = undefined; };
  }, [places]);
  useEffect(() => controller.current?.sync(visibleIds), [visibleIds]);
  return <div class="directory-map-wrap"><p data-map-status aria-live="polite"></p><div ref={element} data-directory-map class="directory-map" aria-label="Ramen places map" role="region" /></div>;
}

function PlaceCard({ place }: { place: ReturnType<typeof toPlaceCard> }) {
  const detailUrl = placeDetailUrl(base, place.id);
  const latest = place.latestVisit
    ? new Intl.DateTimeFormat('en-IL', { dateStyle: 'medium' }).format(new Date(`${place.latestVisit}T12:00:00`))
    : null;
  return <article class="place-card" data-place-card data-place-id={place.id}>
    <a class="place-card__image" href={detailUrl} tabIndex={-1} aria-hidden="true">
      <img src={resolveImageSource(place.coverImage.src, base)} alt={place.coverImage.alt} width="720" height="480" loading="lazy" />
      {place.fictional && <span class="fictional-flag">Fictional example</span>}
    </a>
    <div class="place-card__body">
      <div class="place-card__eyebrow"><StatusChip status={place.status} /><span>{place.location.city} · {place.priceRange}</span></div>
      <div class="place-card__heading"><div><h2><a href={detailUrl}>{place.name}</a></h2><p>{place.description}</p></div><ScoreBadge score={place.score} /></div>
      <div class="tag-list" aria-label="Ramen styles and tags">{[...place.ramenStyles.slice(0, 3), ...place.tags.filter((tag) => tag !== 'fictional').slice(0, 2)].map((tag) => <span key={tag}>{tag}</span>)}</div>
      <div class="place-card__footer"><span>{place.visitCount === 0 ? 'No visits yet' : `${place.visitCount} ${place.visitCount === 1 ? 'visit' : 'visits'}`}</span>{latest && <span>Latest · {latest}</span>}<span class="place-card__arrow" aria-hidden="true">↗</span></div>
    </div>
  </article>;
}

function JournalCard({ entry }: { entry: JournalEntry }) {
  const date = new Intl.DateTimeFormat('en-IL', { dateStyle: 'long' }).format(new Date(`${entry.date}T12:00:00`));
  return <article class="journal-card">
    <a class="journal-card__image" href={placeDetailUrl(base, entry.placeId)} tabIndex={-1} aria-hidden="true">
      <img src={resolveImageSource(entry.coverImage.src, base)} alt={entry.coverImage.alt} width="240" height="240" loading="lazy" />
    </a>
    <div class="journal-card__body">
      <p class="eyebrow">{date}</p>
      <div class="journal-card__heading">
        <div><h3><a href={placeDetailUrl(base, entry.placeId)}>{entry.placeName}</a></h3><p>{entry.city}{entry.dishSummary ? ` · ${entry.dishSummary}` : ''}</p></div>
        <ScoreBadge score={entry.score} />
      </div>
      {entry.notes && <p class="journal-card__note">{entry.notes}</p>}
      <p class="journal-card__reviewers">{entry.reviewerNames.length > 0 ? `Reviewed by ${entry.reviewerNames.join(', ')}` : 'No ratings on this visit'}</p>
    </div>
  </article>;
}

function JournalView({ entries }: { entries: JournalEntry[] }) {
  if (entries.length === 0) return <div class="empty-state journal-empty"><span aria-hidden="true">○</span><h3>Your first bowl starts here</h3><p>Log a visit and it will appear in this timeline.</p></div>;
  return <div class="journal-feed" data-journal-feed>{entries.map((entry) => <JournalCard entry={entry} key={`${entry.placeId}-${entry.visitId}`} />)}</div>;
}

export default function DirectoryApp() {
  const [places, setPlaces] = useState<FirestorePlace[] | null>(null);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState<SortMode>(() => typeof location === 'undefined' ? 'rating' : (new URLSearchParams(location.search).get('sort') as SortMode) || 'rating');
  const [view, setView] = useState<DirectoryView>(initialView);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const previousView = useRef(view);

  useEffect(() => { void loadPublicPlaces().then(setPlaces).catch(() => setError('The ramen list could not be loaded. Check your connection and try again.')); }, []);

  const cards = useMemo(() => places?.map(toPlaceCard) ?? [], [places]);
  const visible = useMemo(() => sortPlaceCards(cards.filter((card) => matchesDirectoryFilters(card, filters)), sort), [cards, filters, sort]);
  const journalEntries = useMemo(() => toJournalEntries(places ?? []), [places]);
  const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));
  const options = useMemo(() => ({
    cities: unique(cards.map((card) => card.location.city)), styles: unique(cards.flatMap((card) => card.ramenStyles)),
    diets: unique(cards.flatMap((card) => card.dietaryOptions)), prices: unique(cards.map((card) => card.priceRange)),
  }), [cards]);
  const mapPlaces = useMemo(() => cards.map((card) => toMapPlace(card, base)), [cards]);

  useEffect(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value && value !== 0) params.set(key, String(value));
    if (sort !== 'rating') params.set('sort', sort);
    if (view !== 'list') params.set('view', view);
    history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}`);
  }, [filters, sort, view]);
  useEffect(() => {
    if (previousView.current === view) return;
    previousView.current = view;
    const frame = requestAnimationFrame(() => {
      const heading = document.getElementById('directory-title');
      heading?.scrollIntoView({ block: 'start' });
      heading?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [view]);

  if (error) return <LoadState><h1>Ramen Radar</h1><p>{error}</p><button onClick={() => location.reload()}>Try again</button></LoadState>;
  if (!places) return <LoadState><p>Loading the ramen radar…</p></LoadState>;
  const visited = places.filter(({ status }) => status === 'visited').length;
  const visits = places.reduce((total, place) => total + place.visits.length, 0);
  const update = (key: keyof DirectoryFilters, value: string) => setFilters((current) => ({ ...current, [key]: key === 'minimumScore' ? Number(value) : value }));
  const filterCount = Object.values(filters).filter((value) => value && value !== 0).length;
  const title = view === 'map' ? 'Ramen map' : view === 'journal' ? 'Visit journal' : 'Ramen places';
  const eyebrow = view === 'map' ? 'Pick by location' : view === 'journal' ? 'Bowls worth remembering' : 'The running list';

  return <main class="directory-app">
    {view === 'list' && <section class="hero shell"><div class="hero__copy"><p class="eyebrow">A personal noodle field guide</p><h1>Good ramen deserves<br /><em>proper notes.</em></h1><p class="hero__intro">Tracking bowls across Givatayim and Tel Aviv—what we want to try, what we ordered, and whether the broth earned a return trip.</p></div><dl class="hero__stats"><div><dt>Places</dt><dd>{String(places.length).padStart(2, '0')}</dd></div><div><dt>Visited</dt><dd>{String(visited).padStart(2, '0')}</dd></div><div><dt>Visits</dt><dd>{String(visits).padStart(2, '0')}</dd></div></dl></section>}
    <section class={`directory shell directory--${view}`} aria-labelledby="directory-title">
      <div class="section-heading section-heading--row"><div><p class="eyebrow">{eyebrow}</p><h2 id="directory-title" tabIndex={-1}>{title}</h2></div><div class="directory-heading-tools"><p aria-live="polite">{view === 'journal' ? `${journalEntries.length} ${journalEntries.length === 1 ? 'visit' : 'visits'}` : `${visible.length} ${visible.length === 1 ? 'place' : 'places'}`}</p><div class="view-toggle" aria-label="Directory view"><button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button><button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')}>Map</button><button type="button" aria-pressed={view === 'journal'} onClick={() => setView('journal')}>Journal</button></div></div></div>
      {view !== 'journal' && <form class="directory-filters" aria-label="Filter ramen places" onReset={() => { setFilters(emptyFilters); setFiltersOpen(false); }}>
        <div class="directory-search-row"><label class="search-field"><span>Search the radar</span><input type="search" value={filters.query} onInput={(event) => update('query', event.currentTarget.value)} placeholder="Place, city, style, tag…" /></label><button class="mobile-filter-toggle" type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)}>Filters{filterCount > 0 ? ` · ${filterCount}` : ''}</button></div>
        <div class={`filter-grid ${filtersOpen ? 'is-open' : ''}`}>
          {([['status', 'Status', [['', 'All statuses'], ['visited', 'Visited'], ['want-to-visit', 'Want to visit'], ['unavailable', 'Unavailable']]], ['city', 'City', [['', 'All cities'], ...options.cities.map((v) => [v, v])]], ['style', 'Style', [['', 'All styles'], ...options.styles.map((v) => [v, v])]], ['diet', 'Dietary', [['', 'All options'], ...options.diets.map((v) => [v, v])]], ['price', 'Price', [['', 'Any price'], ...options.prices.map((v) => [v, v])]], ['minimumScore', 'Minimum rating', [['0', 'Any rating'], ['7', '7+'], ['8', '8+'], ['9', '9+']]]] as const).map(([key, label, values]) => <label key={key}><span>{label}</span><select value={String(filters[key])} onChange={(event) => update(key, event.currentTarget.value)}>{values.map(([value, text]) => <option value={value} key={value}>{text}</option>)}</select></label>)}
          <label><span>Sort by</span><select value={sort} onChange={(event) => setSort(event.currentTarget.value as SortMode)}><option value="rating">Highest rated</option><option value="recent-visit">Recently visited</option><option value="recently-added">Recently added</option><option value="name">Name</option></select></label>
          <button class="text-button" type="reset">Clear filters</button>
        </div>
      </form>}
      {view === 'list' && <div class="place-grid" data-directory-grid>{visible.map((place) => <PlaceCard place={place} key={place.id} />)}</div>}
      {view === 'map' && <DirectoryMap places={mapPlaces} visibleIds={visible.map(({ id }) => id)} />}
      {view === 'journal' && <JournalView entries={journalEntries} />}
      {view !== 'journal' && visible.length === 0 && <div class="empty-state"><span aria-hidden="true">∅</span><h3>No bowls on this frequency</h3><p>Try clearing a filter or searching for something broader.</p></div>}
    </section>
    <MobilePrimaryNav activeView={view} base={base} onNavigate={setView} onQuickAdd={() => setQuickAddOpen(true)} />
    {quickAddOpen && <QuickAddSheet base={base} onClose={() => setQuickAddOpen(false)} />}
  </main>;
}
