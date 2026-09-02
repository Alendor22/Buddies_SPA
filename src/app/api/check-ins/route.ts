import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { distanceMiles, removeCheckIn, saveCheckIn } from '@/lib/checkIns';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const MILES_PER_LATITUDE_DEGREE = 69.0;

function finiteNumber(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// A latitude/longitude box that fully contains the requested radius. It over-selects
// at the corners -- the exact great-circle distance filter still runs afterwards --
// but it lets Postgres discard the rest before LIMIT rather than after.
function boundingBox(latitude: number, longitude: number, radiusMiles: number) {
  const latitudeDelta = radiusMiles / MILES_PER_LATITUDE_DEGREE;
  // Longitude degrees shrink toward the poles. Clamp the cosine so a near-polar
  // request widens the box instead of dividing by zero.
  const longitudeScale = Math.max(0.01, Math.cos((latitude * Math.PI) / 180));
  const longitudeDelta = radiusMiles / (MILES_PER_LATITUDE_DEGREE * longitudeScale);

  return {
    minLatitude: Math.max(-90, latitude - latitudeDelta),
    maxLatitude: Math.min(90, latitude + latitudeDelta),
    minLongitude: longitude - longitudeDelta,
    maxLongitude: longitude + longitudeDelta
  };
}

type CheckInRow = {
  id: string;
  dogId: string;
  userId: string;
  placeName: string;
  latitude: number;
  longitude: number;
  note: string | null;
  createdAt: Date;
  expiresAt: Date;
};

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const latitude = finiteNumber(request.nextUrl.searchParams.get('lat'));
  const longitude = finiteNumber(request.nextUrl.searchParams.get('lng'));
  const radius = Math.max(0.25, Math.min(25, finiteNumber(request.nextUrl.searchParams.get('radius')) ?? 5));

  const hasLocation =
    latitude !== null && longitude !== null &&
    latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;

  // The radius and dog-status filters used to run in JavaScript after the query, so
  // the LIMIT was spent on the 200 newest check-ins anywhere in the world. Past a
  // couple of hundred rows, a user's actual nearby check-ins stopped appearing at all.
  // Both predicates now run in SQL, before the LIMIT.
  const boundsClause = hasLocation
    ? (() => {
        const box = boundingBox(latitude, longitude, radius);
        return Prisma.sql`AND c."latitude" BETWEEN ${box.minLatitude} AND ${box.maxLatitude}
          AND c."longitude" BETWEEN ${box.minLongitude} AND ${box.maxLongitude}`;
      })()
    : Prisma.empty;

  const records = await prisma.$queryRaw<CheckInRow[]>`
    SELECT c."id", c."dogId", c."userId", c."placeName", c."latitude", c."longitude", c."note", c."createdAt", c."expiresAt"
    FROM "CheckIn" c
    LEFT JOIN "SocialPrivacy" p ON p."userId" = c."userId"
    WHERE c."expiresAt" > CURRENT_TIMESTAMP
      AND (c."userId" = ${user.id} OR COALESCE(p."showCheckIns", true) = true)
      AND EXISTS (SELECT 1 FROM "Dog" d WHERE d."id" = c."dogId" AND d."status"::text = 'SAFE')
      ${boundsClause}
    ORDER BY c."createdAt" DESC
    LIMIT 200
  `;

  const dogIds = records.map((record) => record.dogId);
  const dogs = dogIds.length
    ? await prisma.dog.findMany({
        where: { id: { in: dogIds }, status: 'SAFE' },
        select: { id: true, name: true, slug: true, breed: true, photoUrl: true }
      })
    : [];
  const dogById = new Map(dogs.map((dog) => [dog.id, dog]));

  const checkIns = records.flatMap((record) => {
    const dog = dogById.get(record.dogId);
    if (!dog) return [];
    const distance = hasLocation
      ? distanceMiles({ latitude, longitude }, { latitude: record.latitude, longitude: record.longitude })
      : null;
    if (distance !== null && distance > radius) return [];
    return [{
      dog,
      placeName: record.placeName,
      latitude: record.latitude,
      longitude: record.longitude,
      note: record.note,
      checkedInAt: record.createdAt.toISOString(),
      expiresAt: record.expiresAt.toISOString(),
      distanceMiles: distance === null ? null : Number(distance.toFixed(2)),
      mine: record.userId === user.id
    }];
  });

  return NextResponse.json({ checkIns, radiusMiles: radius });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const payload = await request.json().catch(() => null) as {
    dogId?: unknown;
    placeName?: unknown;
    latitude?: unknown;
    longitude?: unknown;
    note?: unknown;
    durationMinutes?: unknown;
  } | null;

  const dogId = typeof payload?.dogId === 'string' ? payload.dogId.trim() : '';
  const placeName = typeof payload?.placeName === 'string' ? payload.placeName.trim() : '';
  const latitude = finiteNumber(payload?.latitude);
  const longitude = finiteNumber(payload?.longitude);
  const note = typeof payload?.note === 'string' ? payload.note.trim().slice(0, 240) || null : null;
  const durationMinutes = Math.round(Math.max(30, Math.min(240, finiteNumber(payload?.durationMinutes) ?? 60)));

  if (!dogId || !placeName || latitude === null || longitude === null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: 'Dog, place, and valid coordinates are required.' }, { status: 400 });
  }

  const dog = await prisma.dog.findFirst({
    where: { id: dogId, OR: [{ ownerId: user.id }, { custodians: { some: { userId: user.id } } }], status: 'SAFE' },
    select: { id: true, name: true }
  });
  if (!dog) return NextResponse.json({ error: 'Dog profile not found or not currently SAFE.' }, { status: 404 });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationMinutes * 60_000);
  await prisma.$transaction([
    prisma.$executeRaw`DELETE FROM "CheckIn" WHERE "dogId" = ${dog.id} AND "expiresAt" > CURRENT_TIMESTAMP`,
    prisma.$executeRaw`INSERT INTO "CheckIn" ("id", "dogId", "userId", "placeName", "latitude", "longitude", "note", "expiresAt", "createdAt") VALUES (${randomUUID()}, ${dog.id}, ${user.id}, ${placeName.slice(0, 120)}, ${latitude}, ${longitude}, ${note}, ${expiresAt}, ${now})`
  ]);

  try {
    await saveCheckIn({
      dogId: dog.id,
      ownerId: user.id,
      placeName: placeName.slice(0, 120),
      latitude,
      longitude,
      note,
      checkedInAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    }, durationMinutes * 60);
  } catch (error) {
    console.warn('Redis check-in acceleration unavailable; Postgres remains authoritative.', error);
  }

  return NextResponse.json({
    checkIn: {
      dog: { id: dog.id, name: dog.name },
      placeName,
      latitude,
      longitude,
      note,
      checkedInAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      distanceMiles: 0,
      mine: true
    }
  }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const payload = await request.json().catch(() => null) as { dogId?: unknown } | null;
  const dogId = typeof payload?.dogId === 'string' ? payload.dogId.trim() : '';
  if (!dogId) return NextResponse.json({ error: 'Dog id is required.' }, { status: 400 });

  const deleted = await prisma.$executeRaw`DELETE FROM "CheckIn" WHERE "dogId" = ${dogId} AND "userId" = ${user.id} AND "expiresAt" > CURRENT_TIMESTAMP`;
  if (!deleted) return NextResponse.json({ error: 'Active check-in not found.' }, { status: 404 });
  try { await removeCheckIn(dogId); } catch (error) { console.warn('Redis check-out cleanup failed.', error); }
  return NextResponse.json({ checkedOut: true });
}
