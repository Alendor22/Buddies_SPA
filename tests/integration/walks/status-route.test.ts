import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WalkInvitationStatus, WalkStatus } from '@/generated/prisma/client';
import { formRequest } from '../../support/next-request';

const getCurrentUserMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  walk: {
    findUnique: vi.fn(),
    update: vi.fn()
  },
  walkInvitation: { updateMany: vi.fn() },
  notification: {
    updateMany: vi.fn(),
    create: vi.fn()
  },
  $transaction: vi.fn()
}));

vi.mock('@/lib/auth', () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock('@/lib/db', () => ({ prisma: prismaMock }));

import { POST } from '@/app/api/walks/status/route';

const acceptedWalk = {
  id: 'walk-1',
  requesterId: 'owner-1',
  walkerId: 'owner-2',
  status: WalkStatus.ACCEPTED,
  dog: { id: 'dog-1', name: 'Luna', ownerId: 'owner-1' },
  invitations: [{
    status: WalkInvitationStatus.ACCEPTED,
    senderDog: { ownerId: 'owner-1' },
    invitedDog: { ownerId: 'owner-2' }
  }]
};

describe('walk status route contracts', () => {
  beforeEach(() => {
    getCurrentUserMock.mockResolvedValue({
      id: 'owner-1',
      email: 'one@example.com',
      displayName: 'One',
      role: 'OWNER'
    });
    prismaMock.walk.findUnique.mockResolvedValue(acceptedWalk);
    prismaMock.$transaction.mockImplementation(async (operation: (tx: typeof prismaMock) => unknown) => operation(prismaMock));
  });

  it('rejects an outsider before creating transactional side effects', async () => {
    getCurrentUserMock.mockResolvedValue({
      id: 'outsider',
      email: 'out@example.com',
      displayName: 'Out',
      role: 'OWNER'
    });

    const response = await POST(formRequest('/api/walks/status', {
      walkId: 'walk-1',
      action: 'start'
    }));

    expect(response.headers.get('location')).toContain('error=unauthorized');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rejects invalid lifecycle transitions', async () => {
    prismaMock.walk.findUnique.mockResolvedValue({
      ...acceptedWalk,
      status: WalkStatus.COMPLETED
    });

    const response = await POST(formRequest('/api/walks/status', {
      walkId: 'walk-1',
      action: 'start'
    }));

    expect(response.headers.get('location')).toContain('error=transition');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('starts an accepted walk and notifies every other participant', async () => {
    const response = await POST(formRequest('/api/walks/status', {
      walkId: 'walk-1',
      action: 'start'
    }));

    expect(prismaMock.walk.update).toHaveBeenCalledWith({
      where: { id: 'walk-1' },
      data: { status: WalkStatus.ACTIVE }
    });
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'owner-2',
        walkId: 'walk-1',
        title: "Luna's walk started"
      })
    });
    expect(response.headers.get('location')).toContain('updated=active');
  });
});
