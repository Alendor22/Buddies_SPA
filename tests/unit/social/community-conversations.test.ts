import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  dogPack: { findUnique: vi.fn() },
  socialEvent: { findUnique: vi.fn() },
  conversation: { upsert: vi.fn() },
  conversationMember: { deleteMany: vi.fn(), createMany: vi.fn() },
  $transaction: vi.fn()
}));

vi.mock('@/lib/db', () => ({ prisma: prismaMock }));

import { syncEventConversation, syncPackConversation } from '@/lib/social/repository';

describe('community conversation synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockResolvedValue([]);
    prismaMock.conversationMember.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.conversationMember.createMany.mockResolvedValue({ count: 0 });
  });

  it('creates a stable pack thread for the owner and accepted dog owners', async () => {
    prismaMock.dogPack.findUnique.mockResolvedValue({
      id: 'pack-1', name: 'Riverside Walkers', ownerId: 'owner-1',
      members: [{ userId: 'owner-1' }, { userId: 'owner-2' }, { userId: 'owner-2' }]
    });
    prismaMock.conversation.upsert.mockResolvedValue({ id: 'conversation-pack-1' });

    await expect(syncPackConversation('pack-1')).resolves.toBe('conversation-pack-1');
    expect(prismaMock.conversation.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { dogPackId: 'pack-1' },
      create: expect.objectContaining({ kind: 'PACK', title: 'Pack: Riverside Walkers', dogPackId: 'pack-1' })
    }));
    expect(prismaMock.conversationMember.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [
        { conversationId: 'conversation-pack-1', userId: 'owner-1', role: 'OWNER' },
        { conversationId: 'conversation-pack-1', userId: 'owner-2', role: 'MEMBER' }
      ],
      skipDuplicates: true
    }));
    expect(prismaMock.conversationMember.deleteMany).toHaveBeenCalledWith({
      where: { conversationId: 'conversation-pack-1', userId: { notIn: ['owner-1', 'owner-2'] } }
    });
  });

  it('creates a meetup thread for its host and going attendees', async () => {
    prismaMock.socialEvent.findUnique.mockResolvedValue({
      id: 'event-1', title: 'Saturday Walk', hostId: 'host-1', attendees: [{ userId: 'guest-1' }, { userId: 'host-1' }]
    });
    prismaMock.conversation.upsert.mockResolvedValue({ id: 'conversation-event-1' });

    await expect(syncEventConversation('event-1')).resolves.toBe('conversation-event-1');
    expect(prismaMock.conversation.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { eventId: 'event-1' },
      create: expect.objectContaining({ kind: 'EVENT', title: 'Meetup: Saturday Walk', eventId: 'event-1' })
    }));
    expect(prismaMock.conversationMember.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [
        { conversationId: 'conversation-event-1', userId: 'host-1', role: 'OWNER' },
        { conversationId: 'conversation-event-1', userId: 'guest-1', role: 'MEMBER' }
      ]
    }));
  });
});
