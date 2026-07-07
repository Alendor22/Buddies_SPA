import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { distanceMiles, getCheckIn, listActiveCheckIns, removeCheckIn, saveCheckIn } from '@/lib/checkIns';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

function finiteNumber(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const latitude = finiteNumber(request.nextUrl.searchParams.get('lat'));
  const longitude = finiteNumber(request.nextUrl.searchParams.get('lng'));
  const radius = Math.max(0.25, Math.min(25, finiteNumber(request.nextUrl.searchParams.get('radius')) ?? 5));

  const records = await listActiveCheckIns();
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

    const distance = latitude !== null && longitude !== null
      ? distanceMiles(
          { latitude, longitude },
          { latitude: record.latitude, longitude: record.longitude }
        )
      : null;

    if (distance !== null && distance > radius) return [];

    return [{
      dog,
      placeName: record.placeName,
      latitude: record.latitude,
      longitude: record.longitude,
      note: record.note,
      checkedInAt: record.checkedInAt,
      expiresAt: record.expiresAt,
      distanceMiles: distance === null ? null : Number(distance.toFixed(2)),
      mine: record.ownerId === user.id
    }];
  }).sort((a, b) => {
    if (a.distanceMiles === null && b.distanceMiles === null) return a.checkedInAt.localeCompare(b.checkedInAt);
    if (a.distanceMiles === null) return 1;
    if (b.distanceMiles === null) return -1;
    return a.distanceMiles - b.distanceMiles;
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
    where: { id: dogId, ownerId: user.id, status: 'SAFE' },
    select: { id: true, name: true }
  });
  if (!dog) return NextResponse.json({ error: 'Dog profile not found or not currently SAFE.' }, { status: 404 });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationMinutes * 60_000);

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
  } catch {
    return NextResponse.json({ error: 'Nearby check-ins require Upstash Redis configuration.' }, { status: 503 });
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

  const current = await getCheckIn(dogId);
  if (!current || current.ownerId !== user.id) {
    return NextResponse.json({ error: 'Active check-in not found.' }, { status: 404 });
  }

  await removeCheckIn(dogId);
  return NextResponse.json({ checkedOut: true });
}
