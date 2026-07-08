import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { heatLevel, neighborhoodKey } from '@/lib/socialMap';

export const dynamic = 'force-dynamic';

function numberParam(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function avatarFor(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const userWithLocation = user as typeof user & {
    latitude?: number | null;
    longitude?: number | null;
    neighborhoodKey?: string | null;
  };

  const latitude = numberParam(request.nextUrl.searchParams.get('lat')) ?? userWithLocation.latitude;
  const longitude = numberParam(request.nextUrl.searchParams.get('lng')) ?? userWithLocation.longitude;
  const key =
    latitude != null && longitude != null
      ? neighborhoodKey(latitude, longitude)
      : userWithLocation.neighborhoodKey ?? undefined;
  const now = new Date();

  const userDogs = await prisma.dog.findMany({ where: { ownerId: user.id }, select: { id: true } });
  const userDogIds = userDogs.map((dog) => dog.id);

  const [presences, reports, routeMemories] = await Promise.all([
    prisma.dogPresence.findMany({
      where: { expiresAt: { gt: now }, ...(key ? { neighborhoodKey: key } : {}) },
      orderBy: { lastHeartbeatAt: 'desc' },
      take: 100,
      include: {
        dog: { select: { id: true, name: true, slug: true, photoUrl: true, breed: true } },
        routeMemory: { select: { id: true, name: true, occurrences: true, confidence: true } }
      }
    }),
    prisma.mapReport.findMany({
      where: { expiresAt: { gt: now }, ...(key ? { neighborhoodKey: key } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { dog: { select: { name: true, slug: true, photoUrl: true } } }
    }),
    prisma.routeMemory.findMany({
      where: { dog: { ownerId: user.id } },
      orderBy: [{ occurrences: 'desc' }, { lastWalkedAt: 'desc' }],
      take: 12,
      include: { dog: { select: { name: true, slug: true } } }
    })
  ]);

  const activeDogIds = presences.map((presence) => presence.dogId);
  const buddyPairs = activeDogIds.length && userDogIds.length
    ? await prisma.dogBuddy.findMany({
        where: {
          OR: [
            { dogAId: { in: userDogIds }, dogBId: { in: activeDogIds } },
            { dogAId: { in: activeDogIds }, dogBId: { in: userDogIds } }
          ]
        },
        select: { dogAId: true, dogBId: true }
      })
    : [];
  const buddyDogIds = new Set(buddyPairs.flatMap((pair) => [pair.dogAId, pair.dogBId]));

  const heatCells = Array.from(
    presences.reduce((cells, presence) => {
      const cellKey = neighborhoodKey(presence.latitude, presence.longitude);
      const [cellLatitude, cellLongitude] = cellKey.split(',').map(Number);
      const current = cells.get(cellKey) ?? { key: cellKey, latitude: cellLatitude, longitude: cellLongitude, activeDogs: 0, buddies: 0 };
      current.activeDogs += 1;
      if (buddyDogIds.has(presence.dogId)) current.buddies += 1;
      cells.set(cellKey, current);
      return cells;
    }, new Map<string, { key: string; latitude: number; longitude: number; activeDogs: number; buddies: number }>()).values()
  ).map((cell) => ({ ...cell, level: heatLevel(cell.activeDogs) }));

  return NextResponse.json({
    center: latitude != null && longitude != null ? { latitude, longitude, neighborhoodKey: key } : null,
    activeDogs: presences.map((presence) => ({
      id: presence.id,
      dogId: presence.dogId,
      dogName: presence.dog.name,
      dogSlug: presence.dog.slug,
      breed: presence.dog.breed,
      avatar: avatarFor(presence.dog.name),
      photoUrl: presence.dog.photoUrl,
      latitude: presence.latitude,
      longitude: presence.longitude,
      status: presence.status,
      walkingScore: presence.walkingScore,
      isBuddy: buddyDogIds.has(presence.dogId),
      halo: buddyDogIds.has(presence.dogId) ? 'ice-blue' : 'neutral',
      routeMemory: presence.routeMemory,
      lastHeartbeatAt: presence.lastHeartbeatAt.toISOString(),
      expiresAt: presence.expiresAt.toISOString()
    })),
    heatCells,
    reports: reports.map((report) => ({
      id: report.id,
      type: report.type,
      title: report.title,
      body: report.body,
      latitude: report.latitude,
      longitude: report.longitude,
      confirmations: report.confirmations,
      dog: report.dog,
      expiresAt: report.expiresAt.toISOString(),
      createdAt: report.createdAt.toISOString()
    })),
    routeMemories: routeMemories.map((route) => ({
      id: route.id,
      dogName: route.dog.name,
      dogSlug: route.dog.slug,
      name: route.name,
      occurrences: route.occurrences,
      confidence: route.confidence,
      distanceMiles: route.routeDistanceMiles,
      durationMin: route.routeDurationMin,
      lastWalkedAt: route.lastWalkedAt.toISOString()
    }))
  });
}
