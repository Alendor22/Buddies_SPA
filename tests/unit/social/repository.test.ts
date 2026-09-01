import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  $transaction: vi.fn()
}));

vi.mock('@/lib/db', () => ({ prisma: prismaMock }));

import {
  addFeedItem,
  blockUser,
  createConversation,
  createEvent,
  createGroup,
  getReputation,
  getSocialPrivacy,
  isConversationMember,
  listBlockedUserIds,
  listConversations,
  listEvents,
  listFeed,
  listGroups,
  listMessages,
  reportContent,
  sendMessage,
  upsertSocialPrivacy
} from '@/lib/social/repository';

const privacy = {
  userId: 'user-1',
  discoverable: true,
  showCity: true,
  allowBuddyRequests: true,
  allowWalkInvites: true,
  allowMessages: true,
  showCheckIns: true,
  showActivity: true
};

describe('Phase 2 social repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$executeRaw.mockResolvedValue(1);
    prismaMock.$transaction.mockImplementation(async (operations: unknown[]) => Promise.all(operations));
  });

  it('reads and upserts social privacy', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([privacy]).mockResolvedValueOnce([privacy]);
    await expect(getSocialPrivacy('user-1')).resolves.toEqual(privacy);
    await expect(upsertSocialPrivacy('user-1', {
      discoverable: true,
      showCity: true,
      allowBuddyRequests: true,
      allowWalkInvites: true,
      allowMessages: true,
      showCheckIns: true,
      showActivity: true
    })).resolves.toEqual(privacy);
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('handles missing privacy and block relationships', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'user-2' }, { id: 'user-3' }]);
    await expect(getSocialPrivacy('missing')).resolves.toBeNull();
    await expect(listBlockedUserIds('user-1')).resolves.toEqual(['user-2', 'user-3']);
    await expect(blockUser('user-1', 'user-2')).resolves.toBeUndefined();
    await expect(blockUser('user-1', 'user-1')).rejects.toThrow('Cannot block self');
  });

  it('creates and reads conversations and messages', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ ok: true }])
      .mockResolvedValueOnce([{ id: 'conversation-1', kind: 'DIRECT', title: null, updatedAt: new Date() }])
      .mockResolvedValueOnce([{ id: 'message-1', senderId: 'user-1', body: 'Hi', createdAt: new Date() }]);

    await expect(createConversation('user-1', 'user-2')).resolves.toEqual(expect.any(String));
    await expect(isConversationMember('conversation-1', 'user-1')).resolves.toBe(true);
    await expect(listConversations('user-1')).resolves.toHaveLength(1);
    await expect(listMessages('conversation-1')).resolves.toHaveLength(1);
    await expect(sendMessage('conversation-1', 'user-1', 'Hello')).resolves.toEqual(expect.any(String));
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
  });

  it('creates groups, feed items, and events', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ id: 'group-1', name: 'Park Dogs', description: null, city: null, joined: true }])
      .mockResolvedValueOnce([{ id: 'feed-1', actorId: 'user-1', type: 'GROUP_CREATED', targetType: 'group', targetId: 'group-1', createdAt: new Date() }])
      .mockResolvedValueOnce([{ id: 'event-1', title: 'Dog walk', locationName: null, startsAt: new Date(), hostId: 'user-1', attending: true }]);

    await expect(createGroup('user-1', 'Park Dogs', null, null)).resolves.toEqual(expect.any(String));
    await expect(listGroups('user-1')).resolves.toHaveLength(1);
    await expect(addFeedItem('user-1', 'GROUP_CREATED', 'group', 'group-1')).resolves.toBeUndefined();
    await expect(listFeed('user-1')).resolves.toHaveLength(1);
    await expect(createEvent('user-1', 'Dog walk', new Date(Date.now() + 60_000), null, null)).resolves.toEqual(expect.any(String));
    await expect(listEvents('user-1')).resolves.toHaveLength(1);
  });

  it('persists moderation reports and computes reputation', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ score: 12 }]).mockResolvedValueOnce([]);
    await expect(reportContent('user-1', 'message', 'message-1', 'spam', 'details', 'user-2', null)).resolves.toEqual(expect.any(String));
    await expect(getReputation('user-1')).resolves.toBe(12);
    await expect(getReputation('user-2')).resolves.toBe(0);
  });
});
