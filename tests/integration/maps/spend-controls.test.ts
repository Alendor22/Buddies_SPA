import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  rateLimit: vi.fn(),
  clientIdentifier: vi.fn(),
  getMapboxToken: vi.fn()
}));

vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('@/lib/rateLimit', () => ({ rateLimit: mocks.rateLimit, clientIdentifier: mocks.clientIdentifier }));
vi.mock('@/lib/mapboxToken', () => ({ getMapboxToken: mocks.getMapboxToken }));

import { POST as directionsPost } from '@/app/api/maps/directions/route';
import { GET as staticGet } from '@/app/api/maps/static/route';

describe('map API spend controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: 'owner-1' });
    mocks.rateLimit.mockResolvedValue({ allowed: true, remaining: 1, retryAfterSeconds: 0 });
    mocks.clientIdentifier.mockReturnValue('203.0.113.5');
    mocks.getMapboxToken.mockReturnValue('pk_test_token');
  });

  it('requires authentication before routing requests reach Mapbox', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const response = await directionsPost(new NextRequest('https://app.test/api/maps/directions', { method: 'POST' }));

    expect(response.status).toBe(401);
    expect(mocks.rateLimit).not.toHaveBeenCalled();
    expect(mocks.getMapboxToken).not.toHaveBeenCalled();
  });

  it('limits authenticated routing requests and returns a retry hint', async () => {
    mocks.rateLimit.mockResolvedValue({ allowed: false, remaining: 0, retryAfterSeconds: 41 });
    const response = await directionsPost(new NextRequest('https://app.test/api/maps/directions', { method: 'POST' }));

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('41');
    expect(mocks.rateLimit).toHaveBeenCalledWith('maps:directions', 'owner-1', 30, 60);
    expect(mocks.getMapboxToken).not.toHaveBeenCalled();
  });

  it('limits public static-map requests by client address', async () => {
    mocks.rateLimit.mockResolvedValue({ allowed: false, remaining: 0, retryAfterSeconds: 60 });
    const request = new NextRequest('https://app.test/api/maps/static?lat=40.7&lng=-74', {
      headers: { 'x-forwarded-for': '203.0.113.5' }
    });
    const response = await staticGet(request);

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(mocks.clientIdentifier).toHaveBeenCalledWith('203.0.113.5');
    expect(mocks.rateLimit).toHaveBeenCalledWith('maps:static', '203.0.113.5', 60, 60);
    expect(mocks.getMapboxToken).not.toHaveBeenCalled();
  });
});
