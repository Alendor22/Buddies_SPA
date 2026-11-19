import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonRequest } from '../../support/next-request';

const getCurrentUserMock = vi.hoisted(() => vi.fn());
const rateLimitMock = vi.hoisted(() => vi.fn());
const createNotificationMock = vi.hoisted(() => vi.fn());
const createEventMock = vi.hoisted(() => vi.fn());
const addFeedItemMock = vi.hoisted(() => vi.fn());
const listBlockedUserIdsMock = vi.hoisted(() => vi.fn());
const syncPackConversationMock = vi.hoisted(() => vi.fn());
const syncEventConversationMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  dog: { findFirst: vi.fn(), findMany: vi.fn() },
  dogPack: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  dogPackMember: {
    findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(),
    update: vi.fn(), updateMany: vi.fn(), create: vi.fn(), createMany: vi.fn(),
    count: vi.fn()
  },
  dogBuddy: { findMany: vi.fn() },
  socialPrivacy: { findMany: vi.fn() },
  routeMemory: { findMany: vi.fn() },
  dogPresence: { findMany: vi.fn() },
  $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops))
}));

vi.mock('@/lib/auth', () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock('@/lib/db', () => ({ prisma: prismaMock }));
vi.mock('@/lib/rateLimit', () => ({ rateLimit: rateLimitMock }));
vi.mock('@/lib/notifications', () => ({ createNotification: createNotificationMock }));
vi.mock('@/lib/social/repository', () => ({
  addFeedItem: addFeedItemMock,
  createEvent: createEventMock,
  syncPackConversation: syncPackConversationMock,
  syncEventConversation: syncEventConversationMock,
  listEvents: vi.fn(),
  listBlockedUserIds: listBlockedUserIdsMock
}));

import { POST as postPack } from '@/app/api/social/packs/route';
import { POST as postEvent } from '@/app/api/social/events/route';
import { GET as getPackSuggestions } from '@/app/api/social/packs/suggestions/route';

describe('dog packs and pack meetups', () => {
  beforeEach(() => {
    getCurrentUserMock.mockResolvedValue({ id: 'owner-1', displayName: 'Owner' });
    rateLimitMock.mockResolvedValue({ allowed: true, remaining: 20, retryAfterSeconds: 60 });
    listBlockedUserIdsMock.mockResolvedValue([]);
    prismaMock.dog.findFirst.mockResolvedValue({ id: 'dog-1' });
    prismaMock.dog.findMany.mockResolvedValue([{ id: 'my-dog', breed: 'Beagle', friendlyDogs: true }]);
    prismaMock.routeMemory.findMany.mockResolvedValue([{ routeHash: 'river-loop' }]);
    prismaMock.dogPresence.findMany.mockResolvedValue([{ neighborhoodKey: 'north-park' }]);
    prismaMock.dogPack.findMany.mockResolvedValue([]);
    prismaMock.dogPack.create.mockResolvedValue({ id: 'pack-1' });
    prismaMock.dogPack.findFirst.mockResolvedValue({ id: 'pack-1' });
    prismaMock.dogPackMember.findFirst.mockResolvedValue({ id: 'membership-1' });
    prismaMock.dogPackMember.findUnique.mockResolvedValue(null);
    prismaMock.dogPackMember.update.mockResolvedValue({});
    prismaMock.dogPackMember.count.mockResolvedValue(3);
    prismaMock.dogPackMember.create.mockResolvedValue({});
    prismaMock.dogPackMember.findMany.mockResolvedValue([]);
    prismaMock.dogPackMember.createMany.mockResolvedValue({ count: 0 });
    prismaMock.dogPackMember.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.dogBuddy.findMany.mockResolvedValue([]);
    prismaMock.socialPrivacy.findMany.mockResolvedValue([]);
    createNotificationMock.mockResolvedValue({});
    createEventMock.mockResolvedValue('event-1');
    syncPackConversationMock.mockResolvedValue('pack-conversation-1');
    syncEventConversationMock.mockResolvedValue('event-conversation-1');
    addFeedItemMock.mockResolvedValue({});
  });

  it('requires authentication before creating a pack', async () => {
    getCurrentUserMock.mockResolvedValueOnce(null);
    const response = await postPack(jsonRequest('/api/social/packs', {
      action: 'create', name: 'Saturday Walkers', dogId: 'dog-1'
    }));

    expect(response.status).toBe(401);
    expect(prismaMock.dogPack.create).not.toHaveBeenCalled();
  });

  it('creates a pack with the creator’s managed safe dog as its first accepted member', async () => {
    const response = await postPack(jsonRequest('/api/social/packs', {
      action: 'create', name: '  Saturday Walkers  ', description: '  Riverside walks  ', dogId: 'dog-1'
    }));

    expect(response.status).toBe(201);
    expect(prismaMock.dogPack.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        ownerId: 'owner-1', name: 'Saturday Walkers', description: 'Riverside walks',
        members: { create: expect.objectContaining({ dogId: 'dog-1', userId: 'owner-1', status: 'ACCEPTED' }) }
      })
    }));
  });

  it('rejects creating a pack from a dog the user does not manage', async () => {
    prismaMock.dog.findFirst.mockResolvedValueOnce(null);
    const response = await postPack(jsonRequest('/api/social/packs', {
      action: 'create', name: 'Saturday Walkers', dogId: 'other-dog'
    }));

    expect(response.status).toBe(403);
    expect(prismaMock.dogPack.create).not.toHaveBeenCalled();
  });

  it('invites an eligible buddy dog with no existing pack membership', async () => {
    prismaMock.dog.findMany
      .mockResolvedValueOnce([{ id: 'my-dog' }])
      .mockResolvedValueOnce([{ id: 'buddy-dog', name: 'Rex', ownerId: 'buddy-owner' }]);
    prismaMock.dogBuddy.findMany.mockResolvedValueOnce([{ dogAId: 'my-dog', dogBId: 'buddy-dog' }]);
    prismaMock.socialPrivacy.findMany.mockResolvedValueOnce([{ userId: 'buddy-owner' }]);
    prismaMock.dogPackMember.findMany.mockResolvedValueOnce([]);

    const response = await postPack(jsonRequest('/api/social/packs', {
      action: 'invite', packId: 'pack-1', dogIds: ['buddy-dog']
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ invited: 1 });
    expect(prismaMock.dogPackMember.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ packId: 'pack-1', dogId: 'buddy-dog', userId: 'buddy-owner', status: 'INVITED' })]
    }));
    expect(createNotificationMock).toHaveBeenCalledTimes(1);
  });

  it('re-invites a dog that previously declined or left a pack, but not one already active in it', async () => {
    prismaMock.dog.findMany
      .mockResolvedValueOnce([{ id: 'my-dog' }])
      .mockResolvedValueOnce([
        { id: 'declined-dog', name: 'Scout', ownerId: 'owner-b' },
        { id: 'active-dog', name: 'Milo', ownerId: 'owner-c' }
      ]);
    prismaMock.dogBuddy.findMany.mockResolvedValueOnce([
      { dogAId: 'my-dog', dogBId: 'declined-dog' },
      { dogAId: 'my-dog', dogBId: 'active-dog' }
    ]);
    prismaMock.socialPrivacy.findMany.mockResolvedValueOnce([{ userId: 'owner-b' }, { userId: 'owner-c' }]);
    prismaMock.dogPackMember.findMany.mockResolvedValueOnce([
      { dogId: 'declined-dog', status: 'DECLINED' },
      { dogId: 'active-dog', status: 'ACCEPTED' }
    ]);

    const response = await postPack(jsonRequest('/api/social/packs', {
      action: 'invite', packId: 'pack-1', dogIds: ['declined-dog', 'active-dog']
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ invited: 1 });
    expect(prismaMock.dogPackMember.updateMany).toHaveBeenCalledWith({
      where: { packId: 'pack-1', dogId: { in: ['declined-dog'] }, status: { in: ['DECLINED', 'LEFT'] } },
      data: expect.objectContaining({ status: 'INVITED', respondedAt: null })
    });
    expect(prismaMock.dogPackMember.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: [] }));
    expect(createNotificationMock).toHaveBeenCalledTimes(1);
    expect(createNotificationMock).toHaveBeenCalledWith(expect.objectContaining({ dogId: 'declined-dog' }));
  });

  it('reports formation only after at least three dogs accepted an invitation', async () => {
    prismaMock.dogPackMember.count.mockResolvedValueOnce(2);
    const response = await postPack(jsonRequest('/api/social/packs', {
      action: 'respond', packId: 'pack-1', dogId: 'dog-2', decision: 'accept'
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ decision: 'accepted', formed: false });
    expect(prismaMock.dogPackMember.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'membership-1' }, data: expect.objectContaining({ status: 'ACCEPTED' })
    }));
  });

  it('allows a pack meetup only when the pack has three accepted dogs', async () => {
    prismaMock.dogPackMember.count.mockResolvedValueOnce(2);
    const response = await postEvent(jsonRequest('/api/social/events', {
      title: 'Pack walk', startsAt: new Date(Date.now() + 60_000).toISOString(), packId: 'pack-1'
    }));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining('three accepted dogs') });
    expect(createEventMock).not.toHaveBeenCalled();
  });

  it('creates a pack meetup after membership and formation checks pass', async () => {
    const response = await postEvent(jsonRequest('/api/social/events', {
      title: 'Pack walk', startsAt: new Date(Date.now() + 60_000).toISOString(), packId: 'pack-1'
    }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ eventId: 'event-1', conversationId: 'event-conversation-1' });
    expect(createEventMock).toHaveBeenCalledWith('owner-1', 'Pack walk', expect.any(Date), null, null, {
      packId: 'pack-1', endsAt: null, latitude: null, longitude: null
    });
    expect(addFeedItemMock).toHaveBeenCalledWith('owner-1', 'EVENT_CREATED', 'event', 'event-1');
  });

  it('does not let a nonmember host a pack meetup', async () => {
    prismaMock.dogPack.findFirst.mockResolvedValueOnce(null);
    const response = await postEvent(jsonRequest('/api/social/events', {
      title: 'Pack walk', startsAt: new Date(Date.now() + 60_000).toISOString(), packId: 'pack-1'
    }));

    expect(response.status).toBe(403);
    expect(prismaMock.dogPackMember.count).not.toHaveBeenCalled();
    expect(createEventMock).not.toHaveBeenCalled();
  });

  it('rejects invalid or past meetup times before persistence', async () => {
    const response = await postEvent(jsonRequest('/api/social/events', {
      title: 'Pack walk', startsAt: new Date(Date.now() - 60_000).toISOString()
    }));

    expect(response.status).toBe(400);
    expect(createEventMock).not.toHaveBeenCalled();
  });

  it('ranks public packs from shared routes, privacy-approved nearby presence, and breed', async () => {
    prismaMock.dogPack.findMany.mockResolvedValueOnce([{
      id: 'public-pack', name: 'River Beagles', description: null, ownerId: 'pack-owner',
      owner: { displayName: 'Pack Owner' },
      members: ['dog-a', 'dog-b', 'dog-c'].map((id) => ({ dog: {
        id, name: id, breed: 'Beagle', photoUrl: null, friendlyDogs: true, status: 'SAFE', ownerId: `owner-${id}`,
        owner: { socialPrivacy: { discoverable: true, showActivity: true, showCheckIns: true } },
        routeMemories: [{ routeHash: 'river-loop' }], presences: [{ neighborhoodKey: 'north-park' }]
      } }))
    }]);

    const response = await getPackSuggestions();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.suggestions[0]).toMatchObject({
      id: 'public-pack', score: 15,
      reasons: expect.arrayContaining(['Shared walking routes', 'Nearby walking area', 'Similar breeds', 'Dog-friendly group'])
    });
    expect(JSON.stringify(body)).not.toMatch(/latitude|longitude|routeHash|neighborhoodKey/);
  });

  it('suppresses pack suggestions without three privacy-visible safe dogs', async () => {
    prismaMock.dogPack.findMany.mockResolvedValueOnce([{
      id: 'private-pack', name: 'Hidden pack', description: null, ownerId: 'pack-owner',
      owner: { displayName: 'Pack Owner' },
      members: ['dog-a', 'dog-b', 'dog-c'].map((id, index) => ({ dog: {
        id, name: id, breed: 'Beagle', photoUrl: null, friendlyDogs: false,
        status: index === 0 ? 'MISSING' : 'SAFE', ownerId: `owner-${id}`,
        owner: { socialPrivacy: { discoverable: index !== 1, showActivity: true, showCheckIns: true } },
        routeMemories: [], presences: []
      } }))
    }]);

    const response = await getPackSuggestions();
    expect((await response.json()).suggestions).toEqual([]);
  });

  it('blocks join requests when either user has blocked the other', async () => {
    prismaMock.dogPack.findFirst.mockResolvedValueOnce({ id: 'pack-1', name: 'Pack', ownerId: 'blocked-owner' });
    listBlockedUserIdsMock.mockResolvedValueOnce(['blocked-owner']);

    const response = await postPack(jsonRequest('/api/social/packs', {
      action: 'request', packId: 'pack-1', dogId: 'dog-1'
    }));

    expect(response.status).toBe(403);
    expect(prismaMock.dogPackMember.create).not.toHaveBeenCalled();
    expect(createNotificationMock).not.toHaveBeenCalled();
  });
});
