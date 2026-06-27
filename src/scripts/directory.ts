const form = document.querySelector<HTMLFormElement>('[data-directory-form]');
const grid = document.querySelector<HTMLElement>('[data-directory-grid]');
const count = document.querySelector<HTMLElement>('[data-result-count]');
const empty = document.querySelector<HTMLElement>('[data-empty-state]');
const mapPanel = document.querySelector<HTMLElement>('[data-map-panel]');
const mapStatus = document.querySelector<HTMLElement>('[data-map-status]');
const viewButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-view-button]')];

if (form && grid && count && empty && mapPanel && viewButtons.length === 2) {
  const cards = [...grid.querySelectorAll<HTMLElement>('[data-place-card]')];
  const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement;
  let currentView = new URLSearchParams(location.search).get('view') === 'map' ? 'map' : 'list';
  let mapController: import('./map-view').MapController | undefined;
  let visibleIds = cards.map((card) => card.dataset.placeId ?? '');

  const setView = async (view: string, update = true) => {
    currentView = view === 'map' ? 'map' : 'list';
    grid.hidden = currentView === 'map';
    mapPanel.hidden = currentView !== 'map';
    for (const button of viewButtons) button.setAttribute('aria-pressed', String(button.dataset.viewButton === currentView));
    if (currentView === 'map') {
      try {
        mapController ??= (await import('./map-view')).initializeDirectoryMap();
        mapController.sync(visibleIds);
        requestAnimationFrame(() => mapController?.resize());
      } catch {
        currentView = 'list';
        grid.hidden = false;
        mapPanel.hidden = true;
        if (mapStatus) mapStatus.textContent = 'The map could not load. The complete list is still available.';
      }
    }
    if (update) apply();
  };

  const restoreFromUrl = () => {
    const params = new URLSearchParams(location.search);
    for (const name of ['query', 'status', 'city', 'style', 'diet', 'price', 'minimumScore', 'sort']) {
      const control = field(name);
      if (control && params.has(name)) control.value = params.get(name) ?? '';
    }
  };

  const apply = () => {
    const query = field('query').value.trim().toLocaleLowerCase();
    const status = field('status').value;
    const city = field('city').value.toLocaleLowerCase();
    const style = field('style').value.toLocaleLowerCase();
    const diet = field('diet').value.toLocaleLowerCase();
    const price = field('price').value;
    const minimumScore = Number(field('minimumScore').value);
    const sort = field('sort').value;

    const visible = cards.filter((card) => {
      const score = card.dataset.score ? Number(card.dataset.score) : null;
      const matches = (!query || card.dataset.search?.includes(query))
        && (!status || card.dataset.status === status)
        && (!city || card.dataset.city === city)
        && (!style || card.dataset.styles?.split('|').includes(style))
        && (!diet || card.dataset.diets?.split('|').includes(diet))
        && (!price || card.dataset.price === price)
        && (minimumScore === 0 || (score !== null && score >= minimumScore));
      card.hidden = !matches;
      return matches;
    });
    visibleIds = visible.map((card) => card.dataset.placeId ?? '');
    mapController?.sync(visibleIds);

    const compare = (a: HTMLElement, b: HTMLElement) => {
      if (sort === 'rating') {
        const aScore = a.dataset.score ? Number(a.dataset.score) : -1;
        const bScore = b.dataset.score ? Number(b.dataset.score) : -1;
        if (aScore !== bScore) return bScore - aScore;
      }
      if (sort === 'recent-visit' && a.dataset.latest !== b.dataset.latest) return (b.dataset.latest ?? '').localeCompare(a.dataset.latest ?? '');
      if (sort === 'recently-added' && a.dataset.added !== b.dataset.added) return (b.dataset.added ?? '').localeCompare(a.dataset.added ?? '');
      return (a.dataset.name ?? '').localeCompare(b.dataset.name ?? '');
    };
    [...visible].sort(compare).forEach((card) => grid.append(card));
    count.textContent = `${visible.length} ${visible.length === 1 ? 'place' : 'places'}`;
    empty.hidden = visible.length !== 0;

    const params = new URLSearchParams();
    for (const name of ['query', 'status', 'city', 'style', 'diet', 'price', 'minimumScore', 'sort']) {
      const value = field(name).value;
      if (value && value !== '0' && !(name === 'sort' && value === 'rating')) params.set(name, value);
    }
    if (currentView === 'map') params.set('view', 'map');
    history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}`);
  };

  restoreFromUrl();
  form.addEventListener('input', apply);
  form.addEventListener('change', apply);
  form.addEventListener('reset', () => requestAnimationFrame(apply));
  for (const button of viewButtons) button.addEventListener('click', () => void setView(button.dataset.viewButton ?? 'list'));
  addEventListener('popstate', () => {
    restoreFromUrl();
    void setView(new URLSearchParams(location.search).get('view') ?? 'list', false).then(apply);
  });
  apply();
  void setView(currentView, false);
}
