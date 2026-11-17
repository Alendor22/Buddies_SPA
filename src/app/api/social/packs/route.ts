import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { NotificationType } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { createNotification } from '@/lib/notifications';
import { rateLimit } from '@/lib/rateLimit';
import { listBlockedUserIds } from '@/lib/social/repository';
import { dogManagerScope } from '@/lib/social/dogManagerScope';

export const dynamic = 'force-dynamic';

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), name: z.string().trim().min(1).max(80), description: z.string().max(500).optional(), dogId: z.string().min(1) }),
  z.object({ action: z.literal('invite'), packId: z.string().min(1), dogIds: z.array(z.string().min(1)).min(1).max(20).refine((ids) => new Set(ids).size === ids.length) }),
  z.object({ action: z.literal('respond'), packId: z.string().min(1), dogId: z.string().min(1), decision: z.enum(['accept', 'decline']) }),
  z.object({ action: z.literal('join'), packId: z.string().min(1), dogId: z.string().min(1) }),
  z.object({ action: z.literal('request'), packId: z.string().min(1), dogId: z.string().min(1) }),
  z.object({ action: z.literal('request-response'), packId: z.string().min(1), dogId: z.string().min(1), decision: z.enum(['accept', 'decline']) })
]);

async function getEligibleDogs(userId: string) {
  const blocked = await listBlockedUserIds(userId);
  const ownDogs = await prisma.dog.findMany({
    where: { ...dogManagerScope(userId), status: 'SAFE' },
    select: { id: true, name: true, breed: true, photoUrl: true, ownerId: true }
  });
  const rawCandidates = await prisma.dog.findMany({
    where: { status: 'SAFE', ownerId: { notIn: [userId, ...blocked] } },
    select: { id: true, name: true, breed: true, photoUrl: true, ownerId: true },
    orderBy: { name: 'asc' },
    take: 300
  });
  const privacy = await prisma.socialPrivacy.findMany({
    where: { userId: { in: [...new Set(rawCandidates.map((dog) => dog.ownerId))] } },
    select: { userId: true, discoverable: true }
  });
  const privacyByUser = new Map(privacy.map((row) => [row.userId, row.discoverable]));
  const candidateDogs = rawCandidates.filter((dog) => privacyByUser.get(dog.ownerId) !== false);
  return { ownDogs, candidateDogs };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const [{ ownDogs, candidateDogs }, packs, invitations] = await Promise.all([
    getEligibleDogs(user.id),
    prisma.dogPack.findMany({
      where: {
        OR: [
          { ownerId: user.id },
          { members: { some: {
            status: 'ACCEPTED',
            dog: dogManagerScope(user.id)
          } } }
        ]
      },
      include: {
        members: { include: { dog: { select: { id: true, name: true, breed: true, photoUrl: true } }, user: { select: { displayName: true } } } },
        _count: { select: { events: true } }
      },
      orderBy: { updatedAt: 'desc' },
      take: 100
    }),
    prisma.dogPackMember.findMany({
      where: {
        status: 'INVITED',
        dog: dogManagerScope(user.id)
      },
      include: {
        dog: { select: { id: true, name: true, breed: true, photoUrl: true } },
        pack: { select: { id: true, name: true, description: true, owner: { select: { displayName: true } } } }
      },
      orderBy: { invitedAt: 'desc' },
      take: 50
    })
  ]);

  return NextResponse.json({
    ownDogs: ownDogs.map(({ id, name, breed, photoUrl }) => ({ id, name, breed, photoUrl })),
    candidateDogs: candidateDogs.map(({ id, name, breed, photoUrl }) => ({ id, name, breed, photoUrl })),
    packs: packs.map((pack) => {
      const accepted = pack.members.filter((member) => member.status === 'ACCEPTED');
      return {
        id: pack.id,
        name: pack.name,
        description: pack.description,
        isOwner: pack.ownerId === user.id,
        formed: accepted.length >= 3,
        acceptedDogs: accepted.map((member) => member.dog),
        pendingDogs: pack.members.filter((member) => member.status === 'INVITED').map((member) => member.dog),
        joinRequests: pack.ownerId === user.id ? pack.members.filter((member) => member.status === 'REQUESTED').map((member) => ({ dogId: member.dog.id, dogName: member.dog.name, requesterName: member.user.displayName })) : [],
        eventsCount: pack._count.events
      };
    }),
    invitations: invitations.map((membership) => ({
      packId: membership.pack.id,
      packName: membership.pack.name,
      packDescription: membership.pack.description,
      invitedDog: membership.dog,
      invitedBy: membership.pack.owner.displayName
    }))
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const limit = await rateLimit('social:packs:write', user.id, 30, 3600);
  if (!limit.allowed) return NextResponse.json({ error: 'Too many pack changes recently. Try again shortly.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } });

  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Check the pack action and required fields.' }, { status: 400 });
  const payload = parsed.data;

  if (payload.action === 'create') {
    const name = payload.name.trim();
    const description = payload.description?.trim().slice(0, 500) || null;
    const dogId = payload.dogId;
    if (!name || !dogId) return NextResponse.json({ error: 'Pack name and a dog you manage are required.' }, { status: 400 });
    const dog = await prisma.dog.findFirst({ where: { id: dogId, ...dogManagerScope(user.id), status: 'SAFE' }, select: { id: true } });
    if (!dog) return NextResponse.json({ error: 'Choose one of your safe dog profiles to start the pack.' }, { status: 403 });
    const pack = await prisma.dogPack.create({
      data: {
        ownerId: user.id,
        name,
        description,
        members: { create: { dogId, userId: user.id, status: 'ACCEPTED', respondedAt: new Date() } }
      },
      select: { id: true }
    });
    return NextResponse.json({ packId: pack.id, message: 'Pack created. Invite eligible community dogs to form your pack.' }, { status: 201 });
  }

  if (payload.action === 'invite') {
    const { packId, dogIds } = payload;
    if (!packId || dogIds.length === 0) return NextResponse.json({ error: 'Choose a pack and at least one dog to invite.' }, { status: 400 });
    const [pack, ownDogs] = await Promise.all([
      prisma.dogPack.findFirst({ where: { id: packId, ownerId: user.id }, select: { id: true, name: true } }),
      prisma.dog.findMany({ where: { ...dogManagerScope(user.id), status: 'SAFE' }, select: { id: true } })
    ]);
    if (!pack) return NextResponse.json({ error: 'Only the pack creator can invite dogs.' }, { status: 403 });
    if (!ownDogs.length) return NextResponse.json({ error: 'A safe dog profile is required to invite pack members.' }, { status: 400 });
    const blocked = await listBlockedUserIds(user.id);
    const eligibleDogs = await prisma.dog.findMany({
      where: { id: { in: dogIds }, status: 'SAFE', ownerId: { notIn: [user.id, ...blocked] } },
      select: { id: true, name: true, ownerId: true }
    });
    const ownerPrivacy = await prisma.socialPrivacy.findMany({
      where: { userId: { in: [...new Set(eligibleDogs.map((dog) => dog.ownerId))] } },
      select: { userId: true, discoverable: true }
    });
    const discoverability = new Map(ownerPrivacy.map((row) => [row.userId, row.discoverable]));
    const visibleDogs = eligibleDogs.filter((dog) => discoverability.get(dog.ownerId) !== false);
    if (!visibleDogs.length) return NextResponse.json({ error: 'Choose safe dogs whose owners are discoverable and have not blocked you.' }, { status: 403 });
    const existingMemberships = await prisma.dogPackMember.findMany({ where: { packId, dogId: { in: visibleDogs.map((dog) => dog.id) } }, select: { dogId: true, status: true } });
    // DECLINED/LEFT rows don't block a fresh invite — a dog that declined or left (possibly
    // unintentionally) can be re-invited. INVITED/ACCEPTED/REQUESTED rows still do: the unique
    // (packId, dogId) constraint means re-inviting one of those must update it, not insert.
    const inactiveDogIds = new Set(existingMemberships.filter((member) => member.status === 'DECLINED' || member.status === 'LEFT').map((member) => member.dogId));
    const activeDogIds = new Set(existingMemberships.filter((member) => !inactiveDogIds.has(member.dogId)).map((member) => member.dogId));
    const newInvites = visibleDogs.filter((dog) => !activeDogIds.has(dog.id) && !inactiveDogIds.has(dog.id));
    const reinvites = visibleDogs.filter((dog) => inactiveDogIds.has(dog.id));
    await prisma.$transaction([
      prisma.dogPackMember.createMany({
        data: newInvites.map((dog) => ({ id: randomUUID(), packId, dogId: dog.id, userId: dog.ownerId, status: 'INVITED' as const })),
        skipDuplicates: true
      }),
      prisma.dogPackMember.updateMany({
        where: { packId, dogId: { in: reinvites.map((dog) => dog.id) }, status: { in: ['DECLINED', 'LEFT'] } },
        data: { status: 'INVITED', respondedAt: null, invitedAt: new Date() }
      })
    ]);
    const invitedDogs = [...newInvites, ...reinvites];
    await Promise.allSettled(invitedDogs.map((dog) => createNotification({
      userId: dog.ownerId,
      type: NotificationType.SYSTEM,
      routeKey: `dog-pack-invite:${packId}:${dog.id}`,
      href: '/dashboard/social#packs',
      title: `Pack invitation: ${pack.name}`,
      body: `${dog.name} has been invited to join a dog pack.`,
      dogId: dog.id
    })));
    return NextResponse.json({ invited: invitedDogs.length });
  }

  if (payload.action === 'respond') {
    const { packId, dogId } = payload;
    const decision = payload.decision === 'accept' ? 'ACCEPTED' : 'DECLINED';
    const invitation = await prisma.dogPackMember.findFirst({
      where: {
        packId,
        dogId,
        status: 'INVITED',
        dog: dogManagerScope(user.id)
      },
      select: { id: true }
    });
    if (!invitation) return NextResponse.json({ error: 'This invitation is unavailable or has already been answered.' }, { status: 404 });
    await prisma.dogPackMember.update({ where: { id: invitation.id }, data: { status: decision, respondedAt: new Date() } });
    const formed = await prisma.dogPackMember.count({ where: { packId, status: 'ACCEPTED' } });
    return NextResponse.json({ decision: decision.toLowerCase(), formed: formed >= 3 });
  }

  if (payload.action === 'join') {
    const { packId, dogId } = payload;
    const [pack, dog, existing] = await Promise.all([
      prisma.dogPack.findFirst({ where: { id: packId, visibility: 'PUBLIC' }, select: { id: true, name: true, ownerId: true } }),
      prisma.dog.findFirst({ where: { id: dogId, ...dogManagerScope(user.id), status: 'SAFE' }, select: { id: true } }),
      prisma.dogPackMember.findUnique({ where: { packId_dogId: { packId, dogId } }, select: { id: true, status: true } })
    ]);
    if (!pack || !dog) return NextResponse.json({ error: 'That public pack or safe dog is unavailable.' }, { status: 404 });
    const blocked = await listBlockedUserIds(user.id);
    if (blocked.includes(pack.ownerId)) return NextResponse.json({ error: 'You cannot join this pack.' }, { status: 403 });
    if (existing?.status === 'ACCEPTED') return NextResponse.json({ joined: true, alreadyMember: true });
    if (existing) {
      await prisma.dogPackMember.update({ where: { id: existing.id }, data: { userId: user.id, status: 'ACCEPTED', respondedAt: new Date() } });
    } else {
      await prisma.dogPackMember.create({ data: { packId, dogId, userId: user.id, status: 'ACCEPTED', respondedAt: new Date() } });
    }
    const formed = await prisma.dogPackMember.count({ where: { packId, status: 'ACCEPTED' } });
    await createNotification({
      userId: pack.ownerId,
      type: NotificationType.SYSTEM,
      routeKey: `dog-pack-joined:${packId}:${dogId}`,
      href: '/dashboard/social#packs',
      title: `A dog joined ${pack.name}`,
      body: 'A dog owner joined your public pack.',
      dogId
    }).catch(() => undefined);
    return NextResponse.json({ joined: true, formed: formed >= 3 }, { status: 201 });
  }

  if (payload.action === 'request') {
    const { packId, dogId } = payload;
    const [pack, dog, existing] = await Promise.all([
      prisma.dogPack.findFirst({ where: { id: packId, visibility: 'PUBLIC' }, select: { id: true, name: true, ownerId: true } }),
      prisma.dog.findFirst({ where: { id: dogId, ...dogManagerScope(user.id), status: 'SAFE' }, select: { id: true } }),
      prisma.dogPackMember.findUnique({ where: { packId_dogId: { packId, dogId } }, select: { status: true } })
    ]);
    if (!pack || !dog) return NextResponse.json({ error: 'That pack or dog is unavailable.' }, { status: 404 });
    const blockedUserIds = await listBlockedUserIds(user.id);
    if (blockedUserIds.includes(pack.ownerId)) {
      return NextResponse.json({ error: 'You cannot request to join this pack.' }, { status: 403 });
    }
    if (existing) return NextResponse.json({ error: 'This dog already has a membership or request for that pack.' }, { status: 409 });
    await prisma.dogPackMember.create({ data: { packId, dogId, userId: user.id, status: 'REQUESTED' } });
    await createNotification({
      userId: pack.ownerId,
      type: NotificationType.SYSTEM,
      routeKey: `dog-pack-request:${packId}:${dogId}`,
      href: '/dashboard/social#packs',
      title: `Join request: ${pack.name}`,
      body: `A dog owner asked to add a dog to your pack.`,
      dogId
    }).catch(() => undefined);
    return NextResponse.json({ requested: true }, { status: 201 });
  }

  if (payload.action === 'request-response') {
    const { packId, dogId } = payload;
    const decision = payload.decision === 'accept' ? 'ACCEPTED' : 'DECLINED';
    const pack = await prisma.dogPack.findFirst({ where: { id: packId, ownerId: user.id }, select: { id: true } });
    if (!pack) return NextResponse.json({ error: 'Only the pack creator can review join requests.' }, { status: 403 });
    const result = await prisma.dogPackMember.updateMany({ where: { packId, dogId, status: 'REQUESTED' }, data: { status: decision, respondedAt: new Date() } });
    if (result.count !== 1) return NextResponse.json({ error: 'This request is unavailable or has already been reviewed.' }, { status: 404 });
    if (decision === 'ACCEPTED') {
      const member = await prisma.dogPackMember.findUnique({ where: { packId_dogId: { packId, dogId } }, include: { pack: { select: { name: true } }, dog: { select: { name: true } } } });
      if (member) await createNotification({
        userId: member.userId,
        type: NotificationType.SYSTEM,
        routeKey: `dog-pack-accepted:${packId}:${dogId}`,
        href: '/dashboard/social#packs',
        title: `Welcome to ${member.pack.name}`,
        body: `${member.dog.name} is now part of the pack.`,
        dogId
      }).catch(() => undefined);
    }
    const formed = await prisma.dogPackMember.count({ where: { packId, status: 'ACCEPTED' } });
    return NextResponse.json({ decision: decision.toLowerCase(), formed: formed >= 3 });
  }

  return NextResponse.json({ error: 'Unknown pack action.' }, { status: 400 });
}
