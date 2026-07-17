import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('filters places, persists search, and resets cleanly', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Ramen places' })).toBeVisible();

  const search = page.getByRole('searchbox', { name: 'Search the radar' });
  await search.fill('tonkotsu');
  await expect(page.getByText('No bowls on this frequency')).toBeVisible();
  await expect(page).toHaveURL(/query=tonkotsu/);

  await page.reload();
  await expect(search).toHaveValue('tonkotsu');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByRole('link', { name: 'Moon Bowl Ramen' })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test('shows aggregate and individual scores across repeat visits', async ({ page }) => {
  await page.goto('/place/?id=moon-bowl-ramen');
  await expect(page.getByRole('heading', { name: 'Moon Bowl Ramen' })).toBeVisible();
  await expect(page.getByText('Fictional example · not a real venue')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Category breakdown' })).toBeVisible();

  const visitsTab = page.getByRole('tab', { name: 'Visits 2' });
  await visitsTab.click();
  await expect(visitsTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: '18 June 2026' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '10 May 2026' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Eyal' })).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Maya' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dan' })).toBeVisible();
});

test('has no serious accessibility violations on core pages', async ({ page }) => {
  for (const path of ['/', '/place/?id=moon-bowl-ramen']) {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);
  }
  await page.goto('/?view=map');
  const marker = page.locator('[data-map-marker="moon-bowl-ramen"]');
  await expect(marker).toHaveCount(1);
  await expect(marker).toHaveCSS('background-color', 'rgb(56, 106, 93)');
  const mapResults = await new AxeBuilder({ page }).analyze();
  expect(mapResults.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);
});

test('mobile place details expose tabs and thumb-reachable actions without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/place/?id=moon-bowl-ramen');

  const overviewTab = page.getByRole('tab', { name: 'Overview' });
  const visitsTab = page.getByRole('tab', { name: 'Visits 2' });
  const loadError = page.getByRole('heading', { name: 'Unable to load place' });
  await expect(overviewTab.or(loadError)).toBeVisible();
  test.skip(await loadError.isVisible(), 'Public Firestore was unavailable to the browser test.');
  await expect(overviewTab).toHaveAttribute('aria-selected', 'true');
  await visitsTab.click();
  await expect(visitsTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: '18 June 2026' })).toBeVisible();

  const dock = page.getByRole('navigation', { name: 'Place actions' });
  await expect(dock).toBeVisible();
  await expect(dock.getByRole('link', { name: 'Directions' })).toBeVisible();
  await expect(dock.getByRole('link', { name: 'Menu' })).toBeVisible();
  await expect(dock.getByRole('link', { name: 'Log visit' }))
    .toHaveAttribute('href', '/manage/?action=log-visit&place=moon-bowl-ramen');
  await expect(dock.getByRole('link', { name: 'Edit' }))
    .toHaveAttribute('href', '/manage/?action=edit-place&place=moon-bowl-ramen');

  const minimumActionHeight = await dock.getByRole('link').evaluateAll((links) => (
    Math.min(...links.map((link) => link.getBoundingClientRect().height))
  ));
  expect(minimumActionHeight).toBeGreaterThanOrEqual(44);

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});

test('legacy place routes redirect to the query-based detail page', async ({ page }) => {
  await page.goto('/places/moon-bowl-ramen/');
  await expect(page).toHaveURL(/\/place\/\?id=moon-bowl-ramen$/);
  await expect(page.getByRole('heading', { name: 'Moon Bowl Ramen' })).toBeVisible();
});

test('manage quick actions remain authentication-gated without changing live data', async ({ page }) => {
  await page.goto('/manage/?action=add-place');
  await expect(page.getByRole('heading', { name: 'Manage Ramen Radar' })).toBeVisible();
  await expect(page.getByText('Sign in with an approved Google account to add places and reviews.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
  await expect(page).toHaveURL(/\/manage\/\?action=add-place$/);
});

test('mobile Journal and Quick add stay reachable from the primary navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const navigation = page.getByRole('navigation', { name: 'Primary mobile navigation' });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Radar' })).toHaveAttribute('aria-current', 'page');

  const journalLink = navigation.getByRole('link', { name: 'Journal' });
  await journalLink.click();
  await expect(page).toHaveURL(/\?view=journal$/);
  await expect(journalLink).toHaveAttribute('aria-current', 'page');
  const journalHeading = page.getByRole('heading', { name: 'Visit journal' });
  await expect(journalHeading).toBeVisible();
  await expect(journalHeading).toBeFocused();

  const quickAddButton = page.getByRole('button', { name: 'Quick add' });
  await quickAddButton.click();
  const dialog = page.getByRole('dialog', { name: 'What are you logging?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('link', { name: /Save a place/ }))
    .toHaveAttribute('href', '/manage/?action=add-place');
  await expect(dialog.getByRole('link', { name: /Log a visit/ }))
    .toHaveAttribute('href', '/manage/?action=log-visit');
  await expect(dialog.getByRole('link', { name: /Add a review/ }))
    .toHaveAttribute('href', '/manage/?action=add-review');

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(quickAddButton).toBeFocused();
});

test('shows a useful state for an unknown place', async ({ page }) => {
  await page.goto('/place/?id=missing-place');
  await expect(page.getByRole('heading', { name: 'Place not found' })).toBeVisible();
});

test('toggles the map, persists its URL state, and opens a place popup', async ({ page }) => {
  await page.goto('/');
  const mapButton = page.getByRole('button', { name: 'Map' });
  await mapButton.click();
  await expect(mapButton).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/view=map/);
  await expect(page.getByRole('region', { name: 'Ramen places map' })).toBeVisible();
  await expect(page.locator('[data-directory-grid]')).toBeHidden();

  await page.locator('[data-map-marker="moon-bowl-ramen"]').click();
  await expect(page.getByRole('link', { name: 'View Moon Bowl Ramen' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true');
});

test('keeps map markers synchronized with directory filters', async ({ page }) => {
  await page.goto('/?view=map');
  await expect(page.locator('[data-map-marker="moon-bowl-ramen"]')).toHaveCount(1);
  await page.getByRole('searchbox', { name: 'Search the radar' }).fill('tonkotsu');
  await expect(page.locator('[data-map-marker="moon-bowl-ramen"]')).toHaveCount(0);
  await expect(page.getByText('No bowls on this frequency')).toBeVisible();
});
