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
  await page.goto('/places/moon-bowl-ramen/');
  await expect(page.getByRole('heading', { name: 'Moon Bowl Ramen' })).toBeVisible();
  await expect(page.getByText('Fictional example · not a real venue')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Category breakdown' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '18 June 2026' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '10 May 2026' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Eyal' })).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Maya' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dan' })).toBeVisible();
});

test('has no serious accessibility violations on core pages', async ({ page }) => {
  for (const path of ['/', '/places/moon-bowl-ramen/']) {
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

test('fits a phone viewport without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/places/moon-bowl-ramen/');
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
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
