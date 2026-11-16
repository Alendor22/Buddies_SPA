import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonRequest } from '../../support/next-request';

const getCurrentUserMock = vi.hoisted(() => vi.fn());
const rateLimitMock = vi.hoisted(() => vi.fn());
const createNotificationMock = vi.hoisted(() => vi.fn());
const createEventMock = vi.hoisted(() => vi.fn());
const addFeedItemMock = vi.hoisted(() => vi.fn());
const listBlockedUserIdsMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  dog: { findFirst: vi.fn(), findMany: vi.fn() },
  dogPack: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  dogPackMember: { findFirst: vi.fn(), update: vi.fn(), count: vi.fn(), create: vi.fn() },
  routeMemory: { findMany: vi.fn() },
  dogPresence: { findMany: vi.fn() }
}));

vi.mock('@/lib/auth', () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock('@/lib/db', () => ({ prisma: prismaMock }));
vi.mock('@/lib/rateLimit', () => ({ rateLimit: rateLimitMock }));
vi.mock('@/lib/notifications', () => ({ createNotification: createNotificationMock }));
vi.mock('@/lib/social/repository', () => ({
  addFeedItem: addFeedItemMock,
  createEvent: createEventMock,
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
    prismaMock.dogPackMember.update.mockResolvedValue({});
    prismaMock.dogPackMember.count.mockResolvedValue(3);
    prismaMock.dogPackMember.create.mockResolvedValue({});
    createNotificationMock.mockResolvedValue({});
    createEventMock.mockResolvedValue('event-1');
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
    expect(await response.json()).toEqual({ eventId: 'event-1' });
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
});
