import { expect, test } from '@playwright/test';

test('Meta endpoints stay inaccessible with default feature flags', async ({ request }) => {
  // Run against the default CI server; no Meta credentials or flags are supplied.
  const result = await request.post('/api/meta/send', { data: { text: 'no send' } });
  expect(result.status()).toBe(404);
  expect(await result.json()).toEqual({ error: 'Meta feature unavailable.' });
  const share = await request.get('/share/meta/00000000-0000-4000-8000-000000000000');
  expect(share.status()).toBe(404);
});
