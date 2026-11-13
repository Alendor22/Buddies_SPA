import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const prismaMock = vi.hoisted(() => ({
  dogPresence: { deleteMany: vi.fn() },
  mapReport: { deleteMany: vi.fn() },
  recognitionEvent: { findMany: vi.fn(), update: vi.fn() }
}));

vi.mock('@/lib/db', () => ({ prisma: prismaMock }));
vi.mock('@/lib/r2', () => ({ r2: { send: vi.fn() } }));

import { GET } from '@/app/api/cron/cleanup-expired/route';

describe('cleanup cron authorization', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('fails closed when CRON_SECRET is missing without deleting data', async () => {
    vi.stubEnv('CRON_SECRET', '');

    const response = await GET(new NextRequest('https://app.test/api/cron/cleanup-expired'));

    expect(response.status).toBe(503);
    expect(prismaMock.dogPresence.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.mapReport.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.recognitionEvent.findMany).not.toHaveBeenCalled();
  });

  it('rejects requests without the configured bearer secret', async () => {
    vi.stubEnv('CRON_SECRET', 'expected-secret');

    const response = await GET(new NextRequest('https://app.test/api/cron/cleanup-expired'));

    expect(response.status).toBe(401);
    expect(prismaMock.dogPresence.deleteMany).not.toHaveBeenCalled();
  });
});
