import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  dogPack: { findUnique: vi.fn() },
  socialEvent: { findUnique: vi.fn(), findMany: vi.fn() },
  socialEventAttendee: { createMany: vi.fn() },
  conversation: { upsert: vi.fn() },
  conversationMember: { deleteMany: vi.fn(), createMany: vi.fn() },
  $transaction: vi.fn()
}));

vi.mock('@/lib/db', () => ({ prisma: prismaMock }));

import { syncEventConversation, syncPackConversation, syncPackEvents } from '@/lib/social/repository';

describe('community conversation synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockResolvedValue([]);
    prismaMock.conversationMember.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.conversationMember.createMany.mockResolvedValue({ count: 0 });
    prismaMock.socialEventAttendee.createMany.mockResolvedValue({ count: 0 });
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

  it('re-syncs every meetup linked to a pack, enrolling newly accepted members as attendees', async () => {
    prismaMock.socialEvent.findMany.mockResolvedValue([{ id: 'event-10' }, { id: 'event-20' }]);
    prismaMock.socialEvent.findUnique.mockImplementation(({ where: { id } }: { where: { id: string } }) =>
      Promise.resolve({
        id,
        title: `Meetup ${id}`,
        hostId: 'host-1',
        attendees: [{ userId: 'host-1' }],
        pack: { members: [{ userId: 'host-1' }, { userId: 'new-member' }] }
      })
    );
    prismaMock.conversation.upsert.mockImplementation(({ where: { eventId } }: { where: { eventId: string } }) =>
      Promise.resolve({ id: `conversation-${eventId}` })
    );

    await syncPackEvents('pack-1');

    expect(prismaMock.socialEvent.findMany).toHaveBeenCalledWith({ where: { packId: 'pack-1' }, select: { id: true } });
    expect(prismaMock.socialEventAttendee.createMany).toHaveBeenCalledWith({
      data: [{ eventId: 'event-10', userId: 'host-1', status: 'GOING' }, { eventId: 'event-10', userId: 'new-member', status: 'GOING' }],
      skipDuplicates: true
    });
    expect(prismaMock.socialEventAttendee.createMany).toHaveBeenCalledWith({
      data: [{ eventId: 'event-20', userId: 'host-1', status: 'GOING' }, { eventId: 'event-20', userId: 'new-member', status: 'GOING' }],
      skipDuplicates: true
    });
    expect(prismaMock.conversationMember.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [
        { conversationId: 'conversation-event-10', userId: 'host-1', role: 'OWNER' },
        { conversationId: 'conversation-event-10', userId: 'new-member', role: 'MEMBER' }
      ]
    }));
  });
});
