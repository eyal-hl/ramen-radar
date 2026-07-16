// @vitest-environment happy-dom

import { h, render as renderDom } from 'preact';
import renderToString from 'preact-render-to-string';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Review, Visit } from '../../domain/place-schema';
import { ReviewComposer } from './ManageApp';

const review = (reviewerId: string, reviewerName: string): Review => ({
  reviewerId,
  reviewerName,
  ratings: {},
});

const visit = (id: string, reviews: Review[]): Visit => ({
  id,
  date: '2026-07-16',
  dishes: [],
  photos: [],
  reviews,
});

describe('ReviewComposer', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the rapid score sheet with visit context and available reviewers', () => {
    const selectedVisit = visit('dinner', [review('eyal', 'Eyal')]);
    const html = renderToString(h(ReviewComposer, {
      placeName: 'Men Tenten',
      visit: selectedVisit,
      visits: [visit('lunch', [review('maya', 'Maya')]), selectedVisit],
      hasUnsavedPlaceChanges: true,
      onClose: vi.fn(),
      onSave: vi.fn().mockResolvedValue(undefined),
    }));

    expect(html).toContain('role="dialog"');
    expect(html).toContain('Men Tenten');
    expect(html).toContain('16 July 2026');
    expect(html).toContain('Maya');
    expect(html).toContain('Add a new reviewer');
    expect(html).not.toContain('Reviewer ID');
    expect(html).toContain('Broth · choose 1–10');
    expect(html.match(/type="radio"/g)).toHaveLength(10);
    expect(html).toContain('Skip · not rated');
    expect(html).toContain('0 of 9 rated');
    expect(html).toContain('Save review');
    expect(html).toContain('also saves your other place edits');
  });

  it('asks only for a display name when no known reviewer is available', () => {
    const selectedVisit = visit('first-visit', []);
    const html = renderToString(h(ReviewComposer, {
      placeName: 'Men Tenten',
      visit: selectedVisit,
      visits: [selectedVisit],
      hasUnsavedPlaceChanges: false,
      onClose: vi.fn(),
      onSave: vi.fn().mockResolvedValue(undefined),
    }));

    expect(html).toContain('New reviewer name');
    expect(html).not.toContain('Reviewer ID');
  });

  it('applies one pointer score to exactly one category', async () => {
    const selectedVisit = visit('dinner', [review('eyal', 'Eyal')]);
    const container = document.createElement('div');
    document.body.append(container);

    await act(() => {
      renderDom(h(ReviewComposer, {
        placeName: 'Men Tenten',
        visit: selectedVisit,
        visits: [visit('lunch', [review('maya', 'Maya')]), selectedVisit],
        hasUnsavedPlaceChanges: false,
        onClose: vi.fn(),
        onSave: vi.fn().mockResolvedValue(undefined),
      }), container);
    });

    const scoreNine = container.querySelector<HTMLInputElement>('input[type="radio"][value="9"]');
    expect(scoreNine).not.toBeNull();
    await act(() => scoreNine?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })));
    const reusedScoreNine = container.querySelector<HTMLInputElement>('input[type="radio"][value="9"]');
    await act(() => reusedScoreNine?.dispatchEvent(new Event('change', { bubbles: true })));

    expect(container.querySelector('button[aria-label="Broth, rated 9"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Noodles, not rated"]')).not.toBeNull();
  });
});
