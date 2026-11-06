import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ state: vi.fn(), claim: vi.fn(), exchange: vi.fn(), graph: vi.fn(), list: vi.fn(), find: vi.fn(), save: vi.fn(), transaction: vi.fn() }));
vi.mock('@/lib/db', () => ({ prisma: { metaOAuthState: { findUnique: mocks.state, deleteMany: mocks.claim }, $transaction: mocks.transaction } }));
vi.mock('@/lib/meta/graph', () => ({ exchangeCode: mocks.exchange, graph: mocks.graph, graphList: mocks.list }));
import { finishConnection } from '@/lib/meta/service';
import { decrypt, hash } from '@/lib/meta/security';
beforeEach(() => {
  for (const flag of ['CORE', 'CONNECTIONS']) vi.stubEnv(`META_${flag}_ENABLED`, 'true');
  vi.stubEnv('META_APP_ORIGIN', 'https://app.test'); vi.stubEnv('META_APP_ID', 'app'); vi.stubEnv('META_APP_SECRET', 'secret'); vi.stubEnv('META_TOKEN_KEY', Buffer.alloc(32, 3).toString('base64'));
  mocks.state.mockResolvedValue({ hash: hash('state'), ownerId: 'owner', browserHash: hash('browser'), purpose: 'facebook', expiresAt: new Date(Date.now() + 600000) });
  mocks.claim.mockResolvedValue({ count: 1 }); mocks.exchange.mockResolvedValue({ access_token: 'user-token', expires_in: 3600 });
  mocks.graph.mockResolvedValue({ data: { user_id: '123', app_id: 'app', is_valid: true, scopes: ['pages_show_list', 'pages_read_engagement'], expires_at: Math.floor(Date.now() / 1000) + 3600 } });
  mocks.list.mockResolvedValue([{ id: '456', name: 'Page', access_token: 'page-token' }]); mocks.find.mockResolvedValue(null);
  mocks.transaction.mockImplementation(callback => callback({ metaConnection: { findUnique: mocks.find, upsert: mocks.save } }));
});
it('saves only encrypted, owner-bound tokens and starts the connection paused', async () => {
  await finishConnection('owner', 'state', 'browser', 'code');
  const saved = mocks.save.mock.calls[0][0].create;
  expect(saved.ownerId).toBe('owner'); expect(saved.enabled).toBe(false);
  expect(saved.providerUserId).toBe('123'); expect(saved.token).not.toContain('page-token');
  expect(decrypt(saved.token, 'owner:facebook:456')).toBe('page-token');
  expect(mocks.exchange).toHaveBeenCalledWith('code', 'https://app.test/api/meta/callback');
});
it('rejects a token for another application', async () => {
  mocks.graph.mockResolvedValue({ data: { app_id: 'wrong', is_valid: true, scopes: [] } });
  await expect(finishConnection('owner', 'state', 'browser', 'code')).rejects.toThrow('permissions'); expect(mocks.save).not.toHaveBeenCalled();
});
it('rejects partial permission consent before asset discovery', async () => {
  mocks.graph.mockResolvedValue({ data: { app_id: 'app', is_valid: true, scopes: ['pages_show_list'] } });
  await expect(finishConnection('owner', 'state', 'browser', 'code')).rejects.toThrow('permissions'); expect(mocks.list).not.toHaveBeenCalled();
});
it('cannot replace an asset registered to another owner', async () => {
  mocks.find.mockResolvedValue({ ownerId: 'other' });
  await expect(finishConnection('owner', 'state', 'browser', 'code')).rejects.toThrow('another Buddies owner'); expect(mocks.save).not.toHaveBeenCalled();
});
