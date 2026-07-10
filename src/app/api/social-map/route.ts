import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { heatLevel, neighborhoodKey } from '@/lib/socialMap';

export const dynamic = 'force-dynamic';

const LIVE_HEAT_WINDOW_MS = 15 * 60 * 1000;

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
    const heatCutoff = new Date(now.getTime() - LIVE_HEAT_WINDOW_MS);

    const userDogs = user
      ? await prisma.dog.findMany({ where: { ownerId: user.id }, select: { id: true } })
      : [];
    const userDogIds = userDogs.map((dog) => dog.id);

    const [presences, reports, routeMemories] = await Promise.all([
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
      }),
      user
        ? prisma.routeMemory.findMany({
            where: { dog: { ownerId: user.id } },
            orderBy: [{ occurrences: 'desc' }, { lastWalkedAt: 'desc' }],
            take: 12,
            include: { dog: { select: { name: true, slug: true } } }
          })
        : Promise.resolve([])
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
        const deviceLoc = deviceLocFor(presence);
        const cellKey = neighborhoodKey(deviceLoc.lat, deviceLoc.lng);
        const [cellLatitude, cellLongitude] = cellKey.split(',').map(Number);
        const weight = heatWeight(presence.lastHeartbeatAt, presence.walkingScore, now);
        const current = cells.get(cellKey) ?? {
          key: cellKey,
          latitude: cellLatitude,
          longitude: cellLongitude,
          activeDogs: 0,
          buddies: 0,
          weight: 0
        };
        current.activeDogs += 1;
        current.weight += weight;
        if (buddyDogIds.has(presence.dogId)) current.buddies += 1;
        cells.set(cellKey, current);
        return cells;
      }, new Map<string, { key: string; latitude: number; longitude: number; activeDogs: number; buddies: number; weight: number }>()).values()
    ).map((cell) => ({
      ...cell,
      weight: Number(cell.weight.toFixed(3)),
      level: heatLevel(Math.max(cell.activeDogs, Math.ceil(cell.weight)))
    }));

    return NextResponse.json({
      authenticated: Boolean(user),
      source: 'device_loc',
      heatWindowMinutes: LIVE_HEAT_WINDOW_MS / 60000,
      center: latitude != null && longitude != null ? { latitude, longitude, neighborhoodKey: key } : null,
      activeDogs: presences.map((presence) => ({
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
  } catch (error) {
    console.error('social-map api failed', error);
    return NextResponse.json({ error: 'Social map unavailable.' }, { status: 500 });
  }
}
