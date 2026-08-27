import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BuddyRequestStatus } from '@prisma/client';
import { formRequest } from '../support/next-request';
import { uniqueTestId } from '../support/unique';

const getCurrentUserMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/auth')>();
  return { ...original, getCurrentUser: getCurrentUserMock };
});

import { prisma } from '@/lib/db';
import { POST } from '@/app/api/dog-buddies/respond/route';

const testEmails = new Set<string>();

afterEach(async () => {
  if (!testEmails.size) return;
  await prisma.user.deleteMany({ where: { email: { in: Array.from(testEmails) } } });
  testEmails.clear();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('dog buddy acceptance under concurrency', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
  });

  it('allows exactly one response to win and emits one set of side effects', async () => {
    const senderEmail = uniqueTestId('sender') + '@example.test';
    const receiverEmail = uniqueTestId('receiver') + '@example.test';
    testEmails.add(senderEmail);
    testEmails.add(receiverEmail);

    const [sender, receiver] = await Promise.all([
      prisma.user.create({
        data: { email: senderEmail, displayName: 'Sender', emailVerifiedAt: new Date() }
      }),
      prisma.user.create({
        data: { email: receiverEmail, displayName: 'Receiver', emailVerifiedAt: new Date() }
      })
    ]);
    const [senderDog, receiverDog] = await Promise.all([
      prisma.dog.create({
        data: { ownerId: sender.id, name: 'Sender Dog', slug: uniqueTestId('sender-dog') }
      }),
      prisma.dog.create({
        data: { ownerId: receiver.id, name: 'Receiver Dog', slug: uniqueTestId('receiver-dog') }
      })
    ]);
    const buddyRequest = await prisma.dogBuddyRequest.create({
      data: {
        senderDogId: senderDog.id,
        receiverDogId: receiverDog.id,
        status: BuddyRequestStatus.PENDING
      }
    });

    getCurrentUserMock.mockResolvedValue({
      id: receiver.id,
      email: receiver.email,
      displayName: receiver.displayName,
      role: receiver.role.toString()
    });

    const responses = await Promise.all([
      POST(formRequest('/api/dog-buddies/respond', {
        requestId: buddyRequest.id,
        action: 'accept'
      })),
      POST(formRequest('/api/dog-buddies/respond', {
        requestId: buddyRequest.id,
        action: 'accept'
      }))
    ]);

    const locations = responses.map((response) => response.headers.get('location') || '');
    expect(locations.filter((location) => location.includes('accepted=1'))).toHaveLength(1);
    expect(locations.filter((location) => location.includes('error=request-resolved'))).toHaveLength(1);

    await expect(prisma.dogBuddy.count({
      where: {
        OR: [
          { dogAId: senderDog.id, dogBId: receiverDog.id },
          { dogAId: receiverDog.id, dogBId: senderDog.id }
        ]
      }
    })).resolves.toBe(1);
    await expect(prisma.buddy.count({
      where: {
        OR: [
          { userAId: sender.id, userBId: receiver.id },
          { userAId: receiver.id, userBId: sender.id }
        ]
      }
    })).resolves.toBe(1);
    await expect(prisma.notification.count({
      where: { dogBuddyRequestId: buddyRequest.id }
    })).resolves.toBe(1);
  });
});
