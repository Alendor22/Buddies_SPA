import { expect, test } from '@playwright/test';

test.describe('public application shell', () => {
  test('loads the product promise and public navigation', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Buddies/);
    await expect(page.getByRole('heading', {
      level: 1,
      name: 'Your dog community, visualized in the real world.'
    })).toBeVisible();

    const featuresButton = page.getByRole('button', { name: 'Features' });
    await expect(featuresButton).toBeVisible();
    await expect(featuresButton).toHaveAttribute('aria-expanded', 'false');
    await featuresButton.click();

    const featuresNav = page.getByRole('navigation', { name: 'Features' });
    await expect(featuresNav).toBeVisible();
    await expect(featuresNav.getByRole('link', { name: 'Map' })).toHaveAttribute('href', '/map');
    await expect(featuresNav.getByRole('link', { name: 'Scanner' })).toHaveAttribute('href', '/scanner');
    await expect(featuresNav.getByRole('link', { name: 'Profiles' })).toHaveAttribute('href', '/dogs');

    const accountActions = page.getByRole('button', { name: 'Account actions' });
    await expect(accountActions).toBeVisible();
    await expect(accountActions).toHaveAttribute('aria-expanded', 'false');
    await accountActions.click();
    await expect(page.getByRole('menuitem', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in');
    await expect(page.getByRole('menuitem', { name: 'Create account' })).toHaveAttribute('href', '/sign-up');
  });

  test('redirects an anonymous visitor to Clerk for protected dog creation', async ({ page }) => {
    await page.goto('/dogs/new');

    await expect(page).toHaveURL(/\/sign-in(?:\/|\?|$)/);
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByText(/sign in/i).first()).toBeVisible();
  });

  test('keeps legacy authentication links compatible with Clerk', async ({ page }) => {
    await page.goto('/auth/register');
    await expect(page).toHaveURL(/\/sign-up(?:\/|\?|$)/);

    await page.goto('/auth/login');
    await expect(page).toHaveURL(/\/sign-in(?:\/|\?|$)/);
  });
});
