import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';
import { heatLevel, neighborhoodKey } from '@/lib/socialMap';

export const dynamic = 'force-dynamic';

const LIVE_HEAT_WINDOW_MS = 15 * 60 * 1000;
const SHARED_CACHE_TTL_SECONDS = 8;
const MEMORY_CACHE_MAX_ENTRIES = 64;
const PRESENCE_TAKE = 150;
const REPORT_TAKE = 75;

function numberParam(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function avatarFor(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

// neighborhoodKey rounds to two decimals, so a key names a ~1.1km cell. Matching on a
// single key put a hard wall down the middle of every cell boundary: a dog one block
// away that rounded into the next cell was invisible. Query the 3x3 block around the
// viewer instead, which makes the boundary continuous.
function neighborhoodKeysAround(latitude: number, longitude: number) {
  const [centerLatitude, centerLongitude] = neighborhoodKey(latitude, longitude).split(',').map(Number);
  const latitudeUnits = Math.round(centerLatitude * 100);
  const longitudeUnits = Math.round(centerLongitude * 100);

  const keys: string[] = [];
  for (let latitudeOffset = -1; latitudeOffset <= 1; latitudeOffset += 1) {
    for (let longitudeOffset = -1; longitudeOffset <= 1; longitudeOffset += 1) {
      keys.push(neighborhoodKey((latitudeUnits + latitudeOffset) / 100, (longitudeUnits + longitudeOffset) / 100));
    }
  }
  return keys;
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

const EMPTY_SHARED: SharedMapData = { activeDogsBase: [], heatCells: [], reports: [] };

// Second-level fallback for the shared cache. Upstash is the real one -- it is shared
// across lambdas -- but when UPSTASH_REDIS_REST_URL is unset every poll from every
// viewer fell straight through to two Postgres queries. A warm lambda at least stops
// re-running them for itself.
const memoryCache = new Map<string, { expiresAtMs: number; payload: SharedMapData }>();

function readMemoryCache(cacheKey: string, nowMs: number) {
  const entry = memoryCache.get(cacheKey);
  if (!entry) return null;
  if (entry.expiresAtMs <= nowMs) {
    memoryCache.delete(cacheKey);
    return null;
  }
  return entry.payload;
}

function writeMemoryCache(cacheKey: string, payload: SharedMapData, nowMs: number) {
  if (memoryCache.size >= MEMORY_CACHE_MAX_ENTRIES) {
    const oldest = memoryCache.keys().next();
    if (!oldest.done) memoryCache.delete(oldest.value);
  }
  memoryCache.set(cacheKey, { expiresAtMs: nowMs + SHARED_CACHE_TTL_SECONDS * 1000, payload });
}

// The presence/report queries and heat-cell aggregation are identical for every viewer
// looking at the same block of neighborhood cells, so they're cached for a few seconds
// and shared across everyone polling that block. Anything user-specific (buddy halos,
// route memories) is layered on per-request below instead of going into this cache.
async function loadSharedMapData(keys: string[] | null, now: Date): Promise<SharedMapData> {
  // No coordinates means no neighborhood. The previous behaviour dropped the
  // neighborhoodKey filter entirely and returned the 150 most recent presences
  // anywhere on earth, which is both a full-table scan and the wrong answer.
  if (!keys || keys.length === 0) return EMPTY_SHARED;

  const cacheKey = `social-map:shared:${[...keys].sort().join('|')}`;
  const nowMs = now.getTime();

  const fromMemory = readMemoryCache(cacheKey, nowMs);
  if (fromMemory) return fromMemory;

  if (redis) {
    const cached = await redis.get<SharedMapData>(cacheKey).catch(() => null);
    if (cached) {
      writeMemoryCache(cacheKey, cached, nowMs);
      return cached;
    }
  }

  const heatCutoff = new Date(nowMs - LIVE_HEAT_WINDOW_MS);

  const [presences, reports] = await Promise.all([
    prisma.dogPresence.findMany({
      where: {
        expiresAt: { gt: now },
        lastHeartbeatAt: { gte: heatCutoff },
        neighborhoodKey: { in: keys }
      },
      orderBy: { lastHeartbeatAt: 'desc' },
      take: PRESENCE_TAKE,
      include: {
        dog: { select: { id: true, name: true, slug: true, photoUrl: true, breed: true } },
        routeMemory: { select: { id: true, name: true, occurrences: true, confidence: true } }
      }
    }),
    prisma.mapReport.findMany({
      where: { expiresAt: { gt: now }, neighborhoodKey: { in: keys } },
      orderBy: { createdAt: 'desc' },
      take: REPORT_TAKE,
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

  writeMemoryCache(cacheKey, payload, nowMs);
  if (redis) {
    await redis.set(cacheKey, payload, { ex: SHARED_CACHE_TTL_SECONDS }).catch(() => undefined);
  }

  return payload;
}

// Anonymous callers get the aggregate heat layer only.
//
// `activeDogs` pairs precise live coordinates and heartbeat timestamps with dog names,
// slugs and photos. Served without a session that is a public, real-time feed of where
// identifiable people are walking alone right now, which is not something this app
// should hand out to unauthenticated callers.
//
// Heat cells stay public: neighborhoodKey rounds to two decimal places (~1.1km), so a
// cell says "somewhere in this area there is walk activity" and nothing more. /map is
// deliberately not behind auth.protect(), so logged-out visitors keep a working map.
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const isAuthenticated = Boolean(user);
    const userWithLocation = user as (typeof user & {
      latitude?: number | null;
      longitude?: number | null;
      neighborhoodKey?: string | null;
    }) | null;

    const latitude = numberParam(request.nextUrl.searchParams.get('lat')) ?? userWithLocation?.latitude;
    const longitude = numberParam(request.nextUrl.searchParams.get('lng')) ?? userWithLocation?.longitude;

    const hasCoordinates =
      latitude != null && longitude != null &&
      latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;

    const key = hasCoordinates
      ? neighborhoodKey(latitude, longitude)
      : userWithLocation?.neighborhoodKey ?? undefined;

    // A stored neighborhoodKey with no coordinates still gives us a cell to centre on.
    const keys = hasCoordinates
      ? neighborhoodKeysAround(latitude, longitude)
      : key
        ? neighborhoodKeysAround(...(key.split(',').map(Number) as [number, number]))
        : null;

    const now = new Date();

    const [userDogs, shared] = await Promise.all([
      user ? prisma.dog.findMany({ where: { ownerId: user.id }, select: { id: true } }) : Promise.resolve([]),
      loadSharedMapData(keys, now)
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
    const heatCells = shared.heatCells.map((cell) => ({
      ...cell,
      buddies: isAuthenticated ? buddiesByCell.get(cell.key) ?? 0 : 0
    }));

    const activeDogs = isAuthenticated
      ? shared.activeDogsBase.map((entry) => ({
          ...entry,
          isBuddy: buddyDogIds.has(entry.dogId),
          halo: buddyDogIds.has(entry.dogId) ? 'ice-blue' : 'neutral'
        }))
      : [];

    // Report locations are fixed hazards rather than people in motion, so they stay
    // visible. The attached dog identity does not -- it names a specific animal and
    // links to its public profile.
    const reports = isAuthenticated
      ? shared.reports
      : shared.reports.map((report) => ({ ...report, dog: null }));

    return NextResponse.json(
      {
        authenticated: isAuthenticated,
        source: 'device_loc',
        heatWindowMinutes: LIVE_HEAT_WINDOW_MS / 60000,
        center: hasCoordinates ? { latitude, longitude, neighborhoodKey: key } : null,
        activeDogs,
        heatCells,
        reports,
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
      },
      {
        headers: {
          // Buddy halos and route memories make this response viewer-specific. The
          // previous `public` directive allowed shared caches to store one user's
          // payload and replay it to another.
          'Cache-Control': 'private, no-store'
        }
      }
    );
  } catch (error) {
    console.error('social-map api failed', error);
    return NextResponse.json({ error: 'Social map unavailable.' }, { status: 500 });
  }
}
