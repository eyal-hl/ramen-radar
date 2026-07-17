// @vitest-environment happy-dom

import { h } from 'preact';
import { render } from 'preact';
import renderToString from 'preact-render-to-string';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MobilePrimaryNav, PlaceActionDock, QuickAddSheet } from './MobileShell';

describe('mobile application shell', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    document.body.style.overflow = '';
  });

  it('renders the three primary destinations and a distinct quick-add action', () => {
    const html = renderToString(h(MobilePrimaryNav, {
      activeView: 'journal',
      base: '/ramen-radar',
      onNavigate: vi.fn(),
      onQuickAdd: vi.fn(),
    }));

    expect(html).toContain('aria-label="Primary mobile navigation"');
    expect(html).toContain('Radar');
    expect(html).toContain('Map');
    expect(html).toContain('Journal');
    expect(html).toContain('Quick add');
    expect(html).toContain('href="/ramen-radar/?view=journal"');
    expect(html).toContain('aria-current="page"');
  });

  it('offers focused quick actions that retain the Pages base path', () => {
    const html = renderToString(h(QuickAddSheet, { base: '/ramen-radar', onClose: vi.fn() }));

    expect(html).toContain('role="dialog"');
    expect(html).toContain('Save a place');
    expect(html).toContain('Log a visit');
    expect(html).toContain('Add a review');
    expect(html).toContain('/ramen-radar/manage/?action=add-place');
    expect(html).toContain('/ramen-radar/manage/?action=log-visit');
    expect(html).toContain('/ramen-radar/manage/?action=add-review');
  });

  it('traps keyboard focus, closes globally with Escape, and restores the trigger', async () => {
    const trigger = document.createElement('button');
    const container = document.createElement('div');
    document.body.append(trigger, container);
    trigger.focus();
    const onClose = vi.fn();

    await act(() => render(h(QuickAddSheet, { base: '/', onClose }), container));
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]');
    const controls = [...container.querySelectorAll<HTMLElement>('button, a[href]')];
    expect(dialog).not.toBeNull();
    expect(document.body.style.overflow).toBe('hidden');

    controls.at(-1)?.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(controls[0]);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onClose).toHaveBeenCalledOnce();

    await act(() => render(null, container));
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe('');
  });

  it('keeps detail-page decisions within thumb reach', () => {
    const html = renderToString(h(PlaceActionDock, {
      base: '/ramen-radar',
      placeId: 'moon bowl',
      mapUrl: 'https://maps.google.com/moon',
      menuUrl: 'https://example.com/menu',
    }));

    expect(html).toContain('Directions');
    expect(html).toContain('Menu');
    expect(html).toContain('Log visit');
    expect(html).toContain('Edit');
    expect(html).toContain('/ramen-radar/manage/?action=log-visit&amp;place=moon%20bowl');
    expect(html).toContain('/ramen-radar/manage/?action=edit-place&amp;place=moon%20bowl');
  });
});
