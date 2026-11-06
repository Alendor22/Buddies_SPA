import { NextRequest } from 'next/server';
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ user: vi.fn(), bucket: vi.fn(), connection: vi.fn(), delivery: vi.fn(), contact: vi.fn(), state: vi.fn(), stateDelete: vi.fn(), shares: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.user }));
vi.mock('@/lib/db', () => ({ prisma: { metaRateBucket: { upsert: mocks.bucket }, metaConnection: { findFirst: mocks.connection }, metaDelivery: { create: mocks.delivery }, metaContact: { findFirst: mocks.contact }, metaOAuthState: { findUnique: mocks.state, deleteMany: mocks.stateDelete }, metaShare: { create: mocks.shares }, dog: { findFirst: mocks.shares } } }));
import { POST } from '@/app/api/meta/[action]/route';
import { finishConnection, sendMessage } from '@/lib/meta/service';
import { hash } from '@/lib/meta/security';
const request = (body: unknown, source = 'https://app.test') => new NextRequest('https://app.test/api/meta/send', { method: 'POST', body: JSON.stringify(body), headers: { origin: source } });
beforeEach(() => {
  for (const flag of ['CORE', 'CONNECTIONS', 'MESSAGING', 'SHARING']) vi.stubEnv(`META_${flag}_ENABLED`, 'true');
  vi.stubEnv('META_APP_ORIGIN', 'https://app.test'); mocks.user.mockResolvedValue({ id: 'owner' }); mocks.bucket.mockResolvedValue({ count: 1 }); mocks.shares.mockResolvedValue({ id: 'dog' });
});
it('rejects unauthenticated mutations', async () => {
  mocks.user.mockResolvedValue(null);
  expect((await POST(request({}), { params: Promise.resolve({ action: 'send' }) })).status).toBe(401);
  expect(mocks.bucket).not.toHaveBeenCalled();
});
it('rejects cross-origin mutations', async () => {
  expect((await POST(request({}, 'https://evil.test'), { params: Promise.resolve({ action: 'send' }) })).status).toBe(403);
  expect(mocks.bucket).not.toHaveBeenCalled();
});
it('fails closed if the limiter database is unavailable or exhausted', async () => {
  mocks.bucket.mockRejectedValue(new Error('offline'));
  expect((await POST(request({}), { params: Promise.resolve({ action: 'send' }) })).status).toBe(503);
  mocks.bucket.mockResolvedValue({ count: 31 });
  expect((await POST(request({}), { params: Promise.resolve({ action: 'send' }) })).status).toBe(429);
});
it('requires explicit share consent', async () => {
  expect((await POST(request({ kind: 'profile', resourceId: 'dog' }), { params: Promise.resolve({ action: 'share' }) })).status).toBe(400);
  expect(mocks.shares).not.toHaveBeenCalled();
});
it('queries connection ownership before sending', async () => {
  mocks.connection.mockResolvedValue(null);
  await expect(sendMessage('owner', { connectionId: 'other-connection', contactId: 'c', senderDogId: 'dog', key: 'key', text: 'hi' })).rejects.toThrow('not found');
  expect(mocks.connection).toHaveBeenCalledWith({ where: { id: 'other-connection', ownerId: 'owner' } }); expect(mocks.delivery).not.toHaveBeenCalled();
});
it('rejects missing consent and expired reply windows', async () => {
  mocks.connection.mockResolvedValue({ id: 'c', enabled: true, expiresAt: new Date(Date.now() + 600000), platform: 'facebook', scopes: ['pages_messaging'] });
  mocks.contact.mockResolvedValue({ externalId: '123', optedInAt: null, lastInboundAt: new Date() });
  await expect(sendMessage('owner', { connectionId: 'c', contactId: 'r', senderDogId: 'dog', key: 'key', text: 'hi' })).rejects.toThrow('consent');
  mocks.contact.mockResolvedValue({ externalId: '123', optedInAt: new Date(), lastInboundAt: new Date(Date.now() - 25 * 3600000) });
  await expect(sendMessage('owner', { connectionId: 'c', contactId: 'r', senderDogId: 'dog', key: 'key', text: 'hi' })).rejects.toThrow('24 hours');
  expect(mocks.delivery).not.toHaveBeenCalled();
});
it('binds OAuth to owner, browser and expiry before consuming state', async () => {
  const entry = { hash: hash('state'), ownerId: 'owner', browserHash: hash('browser'), purpose: 'facebook', expiresAt: new Date(Date.now() + 600000) };
  mocks.state.mockResolvedValue(entry);
  await expect(finishConnection('attacker', 'state', 'browser', 'code')).rejects.toThrow('Invalid');
  await expect(finishConnection('owner', 'state', 'wrong-browser', 'code')).rejects.toThrow('Invalid');
  mocks.state.mockResolvedValue({ ...entry, expiresAt: new Date(0) });
  await expect(finishConnection('owner', 'state', 'browser', 'code')).rejects.toThrow('expired');
  expect(mocks.stateDelete).not.toHaveBeenCalled();
});
it('prevents concurrent callback replays from exchanging a code', async () => {
  mocks.state.mockResolvedValue({ hash: hash('state'), ownerId: 'owner', browserHash: hash('browser'), purpose: 'facebook', expiresAt: new Date(Date.now() + 600000) });
  mocks.stateDelete.mockResolvedValue({ count: 0 }); const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  await expect(finishConnection('owner', 'state', 'browser', 'code')).rejects.toThrow('already used'); expect(fetcher).not.toHaveBeenCalled();
});
