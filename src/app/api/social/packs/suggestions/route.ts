import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { listBlockedUserIds } from '@/lib/social/repository';
import { dogManagerScope } from '@/lib/social/dogManagerScope';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const now = new Date();
  const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const [dogs, blocked] = await Promise.all([
    prisma.dog.findMany({ where: { ...dogManagerScope(user.id), status: 'SAFE' }, select: { id: true, breed: true, friendlyDogs: true } }),
    listBlockedUserIds(user.id)
  ]);
  if (!dogs.length) return NextResponse.json({ suggestions: [] });
  const dogIds = dogs.map((dog) => dog.id);
  const [routes, presences] = await Promise.all([
    prisma.routeMemory.findMany({ where: { dogId: { in: dogIds }, lastWalkedAt: { gte: cutoff } }, select: { routeHash: true } }),
    prisma.dogPresence.findMany({
      where: { dogId: { in: dogIds }, status: { in: ['WALKING', 'LIKELY_WALKING'] }, expiresAt: { gt: now } },
      select: { neighborhoodKey: true }
    })
  ]);
  const routeHashes = new Set(routes.map((route) => route.routeHash));
  const neighborhoods = new Set(presences.map((presence) => presence.neighborhoodKey).filter((key): key is string => Boolean(key)));

  const packs = await prisma.dogPack.findMany({
    where: {
      visibility: 'PUBLIC',
      ownerId: { notIn: [user.id, ...blocked] },
      members: { none: {
        OR: [
          { userId: user.id },
          { dog: { custodians: { some: { userId: user.id, role: { in: ['OWNER', 'CAREGIVER'] } } } } }
        ]
      } },
      owner: { socialPrivacy: { is: { discoverable: true } } }
    },
    include: {
      owner: { select: { displayName: true } },
      members: {
        where: { status: 'ACCEPTED' },
        include: {
          dog: {
            select: {
              id: true,
              name: true,
              breed: true,
              photoUrl: true,
              friendlyDogs: true,
              status: true,
              ownerId: true,
              owner: { select: { socialPrivacy: { select: { discoverable: true, showActivity: true, showCheckIns: true } } } },
              routeMemories: { where: { lastWalkedAt: { gte: cutoff } }, select: { routeHash: true } },
              presences: { where: { status: { in: ['WALKING', 'LIKELY_WALKING'] }, expiresAt: { gt: now } }, select: { neighborhoodKey: true } }
            }
          }
        }
      }
    },
    take: 100
  });

  const suggestions = packs.flatMap((pack) => {
    if (blocked.includes(pack.ownerId)) return [];
    const visibleMembers = pack.members.filter((member) =>
      member.dog.status === 'SAFE' &&
      member.dog.owner.socialPrivacy?.discoverable === true &&
      !blocked.includes(member.dog.ownerId)
    );
    if (visibleMembers.length < 3) return [];
    const reasons = new Set<string>();
    let score = 0;
    if (visibleMembers.some((member) => member.dog.routeMemories.some((route) => routeHashes.has(route.routeHash)))) {
      score += 5;
      reasons.add('Shared walking routes');
    }
    if (visibleMembers.some((member) => member.dog.presences.some((presence) =>
      Boolean(presence.neighborhoodKey) && neighborhoods.has(presence.neighborhoodKey!) &&
      member.dog.owner.socialPrivacy?.showActivity && member.dog.owner.socialPrivacy?.showCheckIns
    ))) {
      score += 6;
      reasons.add('Nearby walking area');
    }
    if (visibleMembers.some((member) => member.dog.breed && dogs.some((dog) => dog.breed?.toLowerCase() === member.dog.breed?.toLowerCase()))) {
      score += 3;
      reasons.add('Similar breeds');
    }
    if (visibleMembers.some((member) => member.dog.friendlyDogs && dogs.some((dog) => dog.friendlyDogs))) {
      score += 1;
      reasons.add('Dog-friendly group');
    }
    if (!reasons.size) return [];
    return [{
      id: pack.id,
      name: pack.name,
      description: pack.description,
      memberCount: visibleMembers.length,
      ownerName: pack.owner.displayName,
      score,
      reasons: [...reasons],
      dogs: visibleMembers.slice(0, 6).map(({ dog }) => ({ id: dog.id, name: dog.name, breed: dog.breed, photoUrl: dog.photoUrl }))
    }];
  }).sort((a, b) => b.score - a.score).slice(0, 20);

  return NextResponse.json({ suggestions });
}
