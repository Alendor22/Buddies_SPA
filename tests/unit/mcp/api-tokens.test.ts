import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';

const prismaMock = vi.hoisted(() => {
  const personalAccessToken = {
    count: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn()
  };
  // createPersonalAccessToken runs count+create inside a transaction (an advisory lock
  // serializes it per user); the mock just invokes the callback with the same client,
  // which is enough to exercise the count/limit/create logic under test here.
  const $transaction = vi.fn((callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock));
  return { personalAccessToken, $executeRaw: vi.fn(), $transaction };
});

vi.mock('@/lib/db', () => ({ prisma: prismaMock }));

import {
  ApiTokenLimitError,
  authenticatePersonalAccessToken,
  createPersonalAccessToken,
  revokePersonalAccessToken
} from '@/lib/apiTokens';

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

describe('personal access tokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mints a prefixed token and stores only its hash', async () => {
    prismaMock.personalAccessToken.count.mockResolvedValue(0);
    prismaMock.personalAccessToken.create.mockImplementation(async ({ data }) => ({
      id: 'tok-1',
      name: data.name,
      createdAt: new Date('2026-01-01T00:00:00Z')
    }));

    const result = await createPersonalAccessToken('user-1', 'ChatGPT connector');

    expect(result.token.startsWith('bdy_pat_')).toBe(true);
    expect(result.name).toBe('ChatGPT connector');
    const createCall = prismaMock.personalAccessToken.create.mock.calls[0][0];
    expect(createCall.data.tokenHash).toBe(sha256(result.token));
    expect(createCall.data.tokenHash).not.toBe(result.token);
  });

  it('refuses to mint a new token once the per-user limit is reached', async () => {
    prismaMock.personalAccessToken.count.mockResolvedValue(20);
    await expect(createPersonalAccessToken('user-1', 'One too many')).rejects.toBeInstanceOf(ApiTokenLimitError);
    expect(prismaMock.personalAccessToken.create).not.toHaveBeenCalled();
  });

  it('authenticates a valid, unrevoked token by its hash and records last-used time', async () => {
    const token = 'bdy_pat_validtoken';
    prismaMock.personalAccessToken.findUnique.mockResolvedValue({
      id: 'tok-1',
      revokedAt: null,
      user: { id: 'user-1', email: 'owner@example.test', displayName: 'Owner', role: 'OWNER' }
    });
    prismaMock.personalAccessToken.update.mockResolvedValue({});

    const user = await authenticatePersonalAccessToken(token);

    expect(user).toEqual({ id: 'user-1', email: 'owner@example.test', displayName: 'Owner', role: 'OWNER' });
    expect(prismaMock.personalAccessToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: sha256(token) },
      select: expect.any(Object)
    });
    expect(prismaMock.personalAccessToken.update).toHaveBeenCalled();
  });

  it('rejects a token that does not carry the expected prefix without querying the database', async () => {
    const user = await authenticatePersonalAccessToken('not-a-buddies-token');
    expect(user).toBeNull();
    expect(prismaMock.personalAccessToken.findUnique).not.toHaveBeenCalled();
  });

  it('rejects an unknown token', async () => {
    prismaMock.personalAccessToken.findUnique.mockResolvedValue(null);
    const user = await authenticatePersonalAccessToken('bdy_pat_unknown');
    expect(user).toBeNull();
  });

  it('rejects a revoked token even if the hash matches', async () => {
    prismaMock.personalAccessToken.findUnique.mockResolvedValue({
      id: 'tok-1',
      revokedAt: new Date(),
      user: { id: 'user-1', email: 'owner@example.test', displayName: 'Owner', role: 'OWNER' }
    });
    const user = await authenticatePersonalAccessToken('bdy_pat_revoked');
    expect(user).toBeNull();
    expect(prismaMock.personalAccessToken.update).not.toHaveBeenCalled();
  });

  it('only revokes a token that belongs to the requesting user', async () => {
    prismaMock.personalAccessToken.updateMany.mockResolvedValue({ count: 1 });
    const revoked = await revokePersonalAccessToken('user-1', 'tok-1');
    expect(revoked).toBe(true);
    expect(prismaMock.personalAccessToken.updateMany).toHaveBeenCalledWith({
      where: { id: 'tok-1', userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) }
    });
  });

  it('reports false when revoking a token that is not owned by the caller or already revoked', async () => {
    prismaMock.personalAccessToken.updateMany.mockResolvedValue({ count: 0 });
    const revoked = await revokePersonalAccessToken('user-1', 'someone-elses-token');
    expect(revoked).toBe(false);
  });
});
