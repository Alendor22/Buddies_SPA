import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';
import { heatLevel, neighborhoodKey } from '@/lib/socialMap';

export const dynamic = 'force-dynamic';

const LIVE_HEAT_WINDOW_MS = 15 * 60 * 1000;
const SHARED_CACHE_TTL_SECONDS = 8;

function numberParam(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function avatarFor(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

function deviceLocFor(presence: {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  speedMph: number | null;
  heading: number | null;
  lastHeartbeatAt: Date;
}) {
  return {
    lat: presence.latitude,
    lng: presence.longitude,
    accuracyMeters: presence.accuracyMeters,
    speedMph: presence.speedMph,
    heading: presence.heading,
    timestamp: presence.lastHeartbeatAt.toISOString()
  };
}

function heatWeight(lastHeartbeatAt: Date, walkingScore: number, now: Date) {
  const ageMs = Math.max(0, now.getTime() - lastHeartbeatAt.getTime());
  const recency = Math.max(0, 1 - ageMs / LIVE_HEAT_WINDOW_MS);
  const confidence = Math.max(0.2, Math.min(1, walkingScore / 100));
  return Number((recency * confidence).toFixed(3));
}

type ActiveDogBase = {
  id: string;
  dogId: string;
  dogName: string;
  dogSlug: string;
  breed: string | null;
  avatar: string;
  photoUrl: string | null;
  device_loc: ReturnType<typeof deviceLocFor>;
  latitude: number;
  longitude: number;
  status: string;
  walkingScore: number;
  heatWeight: number;
  routeMemory: { id: string; name: string; occurrences: number; confidence: number } | null;
  lastHeartbeatAt: string;
  expiresAt: string;
};

type HeatCellBase = { key: string; latitude: number; longitude: number; activeDogs: number; weight: number; level: string };

type SharedMapData = {
  activeDogsBase: ActiveDogBase[];
  heatCells: HeatCellBase[];
  reports: Array<{
    id: string;
    type: string;
    title: string;
    body: string | null;
    latitude: number;
    longitude: number;
    confirmations: number;
    dog: { name: string; slug: string; photoUrl: string | null } | null;
    expiresAt: string;
    createdAt: string;
  }>;
};

// The presence/report queries and heat-cell aggregation are identical for every viewer
// looking at the same neighborhood cell, so they're cached in Redis for a few seconds and
// shared across everyone polling that cell. Anything user-specific (buddy halos, route
// memories) is layered on per-request below instead of going into this cache.
async function loadSharedMapData(key: string | undefined, now: Date): Promise<SharedMapData> {
  const cacheKey = `social-map:shared:${key ?? 'global'}`;
  if (redis) {
    const cached = await redis.get<SharedMapData>(cacheKey).catch(() => null);
    if (cached) return cached;
  }

  const heatCutoff = new Date(now.getTime() - LIVE_HEAT_WINDOW_MS);

  const [presences, reports] = await Promise.all([
    prisma.dogPresence.findMany({
      where: {
        expiresAt: { gt: now },
        lastHeartbeatAt: { gte: heatCutoff },
        ...(key ? { neighborhoodKey: key } : {})
      },
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
    })
  ]);

  const activeDogsBase: ActiveDogBase[] = presences.map((presence) => ({
    id: presence.id,
    dogId: presence.dogId,
    dogName: presence.dog.name,
    dogSlug: presence.dog.slug,
    breed: presence.dog.breed,
    avatar: avatarFor(presence.dog.name),
    photoUrl: presence.dog.photoUrl,
    device_loc: deviceLocFor(presence),
    latitude: presence.latitude,
    longitude: presence.longitude,
    status: presence.status,
    walkingScore: presence.walkingScore,
    heatWeight: heatWeight(presence.lastHeartbeatAt, presence.walkingScore, now),
    routeMemory: presence.routeMemory,
    lastHeartbeatAt: presence.lastHeartbeatAt.toISOString(),
    expiresAt: presence.expiresAt.toISOString()
  }));

  const heatCells = Array.from(
    activeDogsBase.reduce((cells, entry) => {
      const cellKey = neighborhoodKey(entry.device_loc.lat, entry.device_loc.lng);
      const [cellLatitude, cellLongitude] = cellKey.split(',').map(Number);
      const current = cells.get(cellKey) ?? { key: cellKey, latitude: cellLatitude, longitude: cellLongitude, activeDogs: 0, weight: 0 };
      current.activeDogs += 1;
      current.weight += entry.heatWeight;
      cells.set(cellKey, current);
      return cells;
    }, new Map<string, { key: string; latitude: number; longitude: number; activeDogs: number; weight: number }>()).values()
  ).map((cell) => ({
    ...cell,
    weight: Number(cell.weight.toFixed(3)),
    level: heatLevel(Math.max(cell.activeDogs, Math.ceil(cell.weight)))
  }));

  const payload: SharedMapData = {
    activeDogsBase,
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
    }))
  };

  if (redis) {
    await redis.set(cacheKey, payload, { ex: SHARED_CACHE_TTL_SECONDS }).catch(() => undefined);
  }

  return payload;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const userWithLocation = user as (typeof user & {
      latitude?: number | null;
      longitude?: number | null;
      neighborhoodKey?: string | null;
    }) | null;

    const latitude = numberParam(request.nextUrl.searchParams.get('lat')) ?? userWithLocation?.latitude;
    const longitude = numberParam(request.nextUrl.searchParams.get('lng')) ?? userWithLocation?.longitude;
    const key =
      latitude != null && longitude != null
        ? neighborhoodKey(latitude, longitude)
        : userWithLocation?.neighborhoodKey ?? undefined;
    const now = new Date();

    const [userDogs, shared] = await Promise.all([
      user ? prisma.dog.findMany({ where: { ownerId: user.id }, select: { id: true } }) : Promise.resolve([]),
      loadSharedMapData(key, now)
    ]);
    const userDogIds = userDogs.map((dog) => dog.id);
    const activeDogIds = shared.activeDogsBase.map((entry) => entry.dogId);

    const [buddyPairs, routeMemories] = await Promise.all([
      activeDogIds.length && userDogIds.length
        ? prisma.dogBuddy.findMany({
            where: {
              OR: [
                { dogAId: { in: userDogIds }, dogBId: { in: activeDogIds } },
                { dogAId: { in: activeDogIds }, dogBId: { in: userDogIds } }
              ]
            },
            select: { dogAId: true, dogBId: true }
          })
        : Promise.resolve([]),
      user
        ? prisma.routeMemory.findMany({
            where: { dog: { ownerId: user.id } },
            orderBy: [{ occurrences: 'desc' }, { lastWalkedAt: 'desc' }],
            take: 12,
            include: { dog: { select: { name: true, slug: true } } }
          })
        : Promise.resolve([])
    ]);
    const buddyDogIds = new Set(buddyPairs.flatMap((pair) => [pair.dogAId, pair.dogBId]));

    const buddiesByCell = new Map<string, number>();
    for (const entry of shared.activeDogsBase) {
      if (!buddyDogIds.has(entry.dogId)) continue;
      const cellKey = neighborhoodKey(entry.device_loc.lat, entry.device_loc.lng);
      buddiesByCell.set(cellKey, (buddiesByCell.get(cellKey) ?? 0) + 1);
    }
    const heatCells = shared.heatCells.map((cell) => ({ ...cell, buddies: buddiesByCell.get(cell.key) ?? 0 }));

    const activeDogs = shared.activeDogsBase.map((entry) => ({
      ...entry,
      isBuddy: buddyDogIds.has(entry.dogId),
      halo: buddyDogIds.has(entry.dogId) ? 'ice-blue' : 'neutral'
    }));

    return NextResponse.json({
      authenticated: Boolean(user),
      source: 'device_loc',
      heatWindowMinutes: LIVE_HEAT_WINDOW_MS / 60000,
      center: latitude != null && longitude != null ? { latitude, longitude, neighborhoodKey: key } : null,
      activeDogs,
      heatCells,
      reports: shared.reports,
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
  } catch (error) {
    console.error('social-map api failed', error);
    return NextResponse.json({ error: 'Social map unavailable.' }, { status: 500 });
  }
}
