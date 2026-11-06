import { expect, test } from '@playwright/test';

test('Meta endpoints stay inaccessible with default feature flags', async ({ request, page }) => {
  // Run against the default CI server; no Meta credentials or flags are supplied.
  const result = await request.post('/api/meta/send', { data: { text: 'no send' } });
  expect(result.status()).toBe(404);
  expect(await result.json()).toEqual({ error: 'Meta feature unavailable.' });
  // Root loading.tsx allows streaming before notFound(), so the document may
  // carry HTTP 200. Assert the actual unavailable view and privacy outcome.
  await page.goto('/share/meta/00000000-0000-4000-8000-000000000000');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page.getByText('Shared with permission.', { exact: false })).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/);
});
