// @vitest-environment happy-dom

import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import type { FirestorePlace } from '../../domain/firestore-model';
import { PlaceContent } from './PlaceDetailApp';

const place: FirestorePlace = {
  id: 'moon-bowl', fictional: false, name: 'Moon Bowl', description: 'A focused shoyu counter.',
  status: 'visited', addedAt: '2026-01-01',
  location: { address: '1 Test Street', city: 'Tel Aviv', latitude: 32, longitude: 34, mapUrl: 'https://maps.google.com/moon' },
  links: { menu: 'https://example.com/menu' }, priceRange: '$$', currency: 'ILS', ramenStyles: ['shoyu'],
  dietaryOptions: [], tags: [], coverImage: { src: '/cover.svg', alt: 'Moon Bowl ramen' }, gallery: [], archived: false,
  visits: [{
    id: 'dinner', date: '2026-07-12', notes: 'Silky broth.', photos: [],
    dishes: [{ name: 'Shoyu special' }],
    reviews: [{ reviewerId: 'eyal', reviewerName: 'Eyal', ratings: { broth: 9, noodles: 8 } }],
  }],
};

describe('place detail mobile journey', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('starts with an overview and keeps contextual decisions available', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    await act(() => render(h(PlaceContent, { place, base: '/ramen-radar' }), container));

    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toContain('Overview');
    expect(container.textContent).toContain('A focused shoyu counter.');
    expect(container.querySelector<HTMLAnchorElement>('a[href="https://maps.google.com/moon"]')?.textContent).toContain('Directions');
    expect(container.querySelector<HTMLAnchorElement>('a[href="/ramen-radar/manage/?action=log-visit&place=moon-bowl"]')).not.toBeNull();
    expect(container.querySelector<HTMLAnchorElement>('a[href="/ramen-radar/manage/?action=edit-place&place=moon-bowl"]')).not.toBeNull();
  });

  it('switches to a chronological visit log without navigating away', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    await act(() => render(h(PlaceContent, { place, base: '/ramen-radar' }), container));
    const visitsTab = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(({ textContent }) => textContent?.includes('Visits'));

    await act(() => visitsTab?.click());

    expect(visitsTab?.getAttribute('aria-selected')).toBe('true');
    expect(container.textContent).toContain('12 July 2026');
    expect(container.textContent).toContain('Shoyu special');
    expect(container.textContent).toContain('Eyal');
  });
});
