import { beforeEach, describe, expect, it, vi } from 'vitest';

const redisMock = vi.hoisted(() => ({
  incr: vi.fn(),
  expire: vi.fn()
}));

vi.mock('@/lib/redis', () => ({ redis: redisMock }));

import { clientIdentifier, rateLimit } from '@/lib/rateLimit';

describe('authentication rate limiting', () => {
  beforeEach(() => {
    redisMock.incr.mockResolvedValue(1);
    redisMock.expire.mockResolvedValue(1);
  });

  it('uses the first forwarded address and a safe fallback', () => {
    expect(clientIdentifier('203.0.113.4, 10.0.0.1')).toBe('203.0.113.4');
    expect(clientIdentifier(null)).toBe('unknown-client');
  });

  it('creates an expiring, hashed bucket for the first request', async () => {
    const result = await rateLimit('login:email', 'owner@example.test', 5, 900);

    expect(result).toEqual({ allowed: true, remaining: 4, retryAfterSeconds: 0 });
    expect(redisMock.incr).toHaveBeenCalledWith(expect.stringMatching(/^rl:login:email:[a-f0-9]{32}:\d+$/));
    expect(redisMock.incr.mock.calls[0][0]).not.toContain('owner@example.test');
    expect(redisMock.expire).toHaveBeenCalledWith(expect.any(String), 900);
  });

  it('blocks requests above the configured limit', async () => {
    redisMock.incr.mockResolvedValue(6);

    await expect(rateLimit('login:email', 'owner@example.test', 5, 900)).resolves.toEqual({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 900
    });
    expect(redisMock.expire).not.toHaveBeenCalled();
  });

  it('fails open when Redis is unavailable', async () => {
    redisMock.incr.mockRejectedValue(new Error('redis unavailable'));

    await expect(rateLimit('login:ip', '203.0.113.4', 10, 900)).resolves.toEqual({
      allowed: true,
      remaining: 10,
      retryAfterSeconds: 0
    });
  });
});
