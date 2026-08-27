import { expect, test } from '@playwright/test';

test.describe('public application shell', () => {
  test('loads the product promise and public navigation', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Buddies/);
    await expect(page.getByRole('heading', {
      level: 1,
      name: 'Your dog community, visualized in the real world.'
    })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open spatial map' })).toHaveAttribute('href', '/map');
  });

  test('redirects an anonymous visitor away from protected dog creation', async ({ page }) => {
    await page.goto('/dogs/new');

    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  });
});
