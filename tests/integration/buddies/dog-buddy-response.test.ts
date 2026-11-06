import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BuddyRequestStatus } from '@/generated/prisma/client';
import { formRequest } from '../../support/next-request';

const getCurrentUserMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  dogBuddyRequest: {
    findUnique: vi.fn(),
    updateMany: vi.fn()
  },
  dogBuddy: { upsert: vi.fn() },
  buddy: { upsert: vi.fn() },
  notification: {
    updateMany: vi.fn(),
    create: vi.fn()
  },
  $transaction: vi.fn()
}));

vi.mock('@/lib/auth', () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock('@/lib/db', () => ({ prisma: prismaMock }));

import { POST } from '@/app/api/dog-buddies/respond/route';

const pendingRequest = {
  id: 'request-1',
  status: BuddyRequestStatus.PENDING,
  senderDog: { id: 'dog-z', name: 'Ziggy', ownerId: 'owner-z' },
  receiverDog: { id: 'dog-a', name: 'Alfie', ownerId: 'owner-a' }
};

describe('dog buddy response transaction', () => {
  beforeEach(() => {
    getCurrentUserMock.mockResolvedValue({
      id: 'owner-a',
      email: 'a@example.com',
      displayName: 'A',
      role: 'OWNER'
    });
    prismaMock.dogBuddyRequest.findUnique.mockResolvedValue(pendingRequest);
    prismaMock.dogBuddyRequest.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.$transaction.mockImplementation(async (operation: (tx: typeof prismaMock) => unknown) => operation(prismaMock));
  });

  it('allows only the receiving owner to accept', async () => {
    getCurrentUserMock.mockResolvedValue({
      id: 'outsider',
      email: 'out@example.com',
      displayName: 'Out',
      role: 'OWNER'
    });

    const response = await POST(formRequest('/api/dog-buddies/respond', {
      requestId: 'request-1',
      action: 'accept'
    }));

    expect(response.headers.get('location')).toContain('error=unauthorized');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('uses a compare-and-set transition before creating both buddy links', async () => {
    const response = await POST(formRequest('/api/dog-buddies/respond', {
      requestId: 'request-1',
      action: 'accept'
    }));

    expect(prismaMock.dogBuddyRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'request-1', status: BuddyRequestStatus.PENDING },
      data: expect.objectContaining({ status: BuddyRequestStatus.ACCEPTED })
    }));
    expect(prismaMock.dogBuddy.upsert).toHaveBeenCalledWith({
      where: { dogAId_dogBId: { dogAId: 'dog-a', dogBId: 'dog-z' } },
      create: { dogAId: 'dog-a', dogBId: 'dog-z' },
      update: {}
    });
    expect(prismaMock.buddy.upsert).toHaveBeenCalledWith({
      where: { userAId_userBId: { userAId: 'owner-a', userBId: 'owner-z' } },
      create: { userAId: 'owner-a', userBId: 'owner-z' },
      update: {}
    });
    expect(response.headers.get('location')).toContain('accepted=1');
  });

  it('does not create side effects when another request already won the race', async () => {
    prismaMock.dogBuddyRequest.updateMany.mockResolvedValue({ count: 0 });

    const response = await POST(formRequest('/api/dog-buddies/respond', {
      requestId: 'request-1',
      action: 'accept'
    }));

    expect(prismaMock.dogBuddy.upsert).not.toHaveBeenCalled();
    expect(prismaMock.buddy.upsert).not.toHaveBeenCalled();
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toContain('error=request-resolved');
  });
});
