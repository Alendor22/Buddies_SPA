import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formRequest } from '../../support/next-request';

const getCurrentUserMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  dog: {
    findFirst: vi.fn(),
    delete: vi.fn(),
    update: vi.fn()
  }
}));

vi.mock('@/lib/auth', () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock('@/lib/db', () => ({ prisma: prismaMock }));

import { POST } from '@/app/api/dogs/manage/route';

describe('dog management ownership contracts', () => {
  beforeEach(() => {
    getCurrentUserMock.mockResolvedValue({
      id: 'owner-1',
      email: 'owner@example.com',
      displayName: 'Owner',
      role: 'OWNER'
    });
  });

  it('redirects anonymous writes before reading form data or the database', async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const response = await POST(formRequest('/api/dogs/manage', {
      id: 'dog-1',
      _intent: 'remove'
    }));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('http://localhost:3000/auth/login');
    expect(prismaMock.dog.findFirst).not.toHaveBeenCalled();
  });

  it.each(['remove', 'lost', 'safe'])('does not allow %s on a dog the actor does not own', async (intent) => {
    prismaMock.dog.findFirst.mockResolvedValue(null);

    const response = await POST(formRequest('/api/dogs/manage', {
      id: 'foreign-dog',
      _intent: intent
    }));

    expect(prismaMock.dog.findFirst).toHaveBeenCalledWith({
      where: { id: 'foreign-dog', ownerId: 'owner-1' },
      select: { id: true, slug: true }
    });
    expect(response.headers.get('location')).toBe('http://localhost:3000/dogs?error=dog-not-found');
    expect(prismaMock.dog.delete).not.toHaveBeenCalled();
    expect(prismaMock.dog.update).not.toHaveBeenCalled();
  });

  it('marks an owned dog lost with bounded optional fields', async () => {
    prismaMock.dog.findFirst.mockResolvedValue({ id: 'dog-1', slug: 'luna' });
    prismaMock.dog.update.mockResolvedValue({ id: 'dog-1' });

    const response = await POST(formRequest('/api/dogs/manage', {
      id: 'dog-1',
      _intent: 'lost',
      lastSeenLocation: ' Riverside Park ',
      lostReward: ' $100 ',
      lostNotes: ' Blue collar '
    }));

    expect(prismaMock.dog.update).toHaveBeenCalledWith({
      where: { id: 'dog-1' },
      data: {
        status: 'LOST',
        lostSince: expect.any(Date),
        lastSeenLocation: 'Riverside Park',
        lostReward: '$100',
        lostNotes: 'Blue collar'
      }
    });
    expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard?lost=1');
  });

  it('removes only the ownership-scoped dog returned by the lookup', async () => {
    prismaMock.dog.findFirst.mockResolvedValue({ id: 'dog-1', slug: 'luna' });

    const response = await POST(formRequest('/api/dogs/manage', {
      id: 'dog-1',
      _intent: 'remove'
    }));

    expect(prismaMock.dog.delete).toHaveBeenCalledWith({ where: { id: 'dog-1' } });
    expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard?removed=1');
  });
});
