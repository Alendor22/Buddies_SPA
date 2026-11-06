import { createHmac } from 'node:crypto';
import { expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ metaConnection: { findMany: vi.fn(), deleteMany: vi.fn() }, metaOAuthState: { deleteMany: vi.fn() }, $transaction: vi.fn() }));
vi.mock('@/lib/db', () => ({ prisma: db }));
import { POST } from '@/app/api/meta/deauthorize/route';
it('rejects unsigned deletion requests without erasing any data', async () => {
  const response = await POST(new Request('https://app.test', { method: 'POST', body: 'signed_request=forged' }));
  expect(response.status).toBe(403); expect(db.metaConnection.deleteMany).not.toHaveBeenCalled();
});
it('erases only the signed provider subject and remains available with feature flags off', async () => {
  vi.stubEnv('META_APP_SECRET', 'test'); vi.stubEnv('META_APP_ORIGIN', 'https://app.test'); vi.stubEnv('META_CORE_ENABLED', 'false');
  db.metaConnection.findMany.mockResolvedValue([{ ownerId: 'owner' }]); db.$transaction.mockResolvedValue([]);
  const payload = Buffer.from(JSON.stringify({ algorithm: 'HMAC-SHA256', user_id: '123', issued_at: Math.floor(Date.now() / 1000) })).toString('base64url');
  const signature = createHmac('sha256', 'test').update(payload).digest('base64url');
  const result = await POST(new Request('https://app.test', { method: 'POST', body: new URLSearchParams({ signed_request: `${signature}.${payload}` }) }));
  expect(result.status).toBe(200); expect(db.metaConnection.deleteMany).toHaveBeenCalledWith({ where: { providerUserId: '123' } });
  expect((await result.json()).url).toMatch(/^https:\/\/app.test\/meta\/deletion\?confirmation=/);
});
