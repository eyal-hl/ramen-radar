import { h } from 'preact';
import render from 'preact-render-to-string';
import { describe, expect, it, vi } from 'vitest';
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
  it('renders the rapid score sheet with visit context and available reviewers', () => {
    const selectedVisit = visit('dinner', [review('eyal', 'Eyal')]);
    const html = render(h(ReviewComposer, {
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
    const html = render(h(ReviewComposer, {
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
});
