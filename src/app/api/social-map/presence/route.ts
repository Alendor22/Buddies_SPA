import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { neighborhoodKey, presenceStatusFromScore, walkingConfidence } from '@/lib/socialMap';

export const dynamic = 'force-dynamic';

function numeric(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  const dogId = String(payload?.dogId ?? '').trim();
  const walkId = String(payload?.walkId ?? '').trim() || null;
  const latitude = numeric(payload?.latitude);
  const longitude = numeric(payload?.longitude);
  const speedMph = numeric(payload?.speedMph);
  const accuracyMeters = numeric(payload?.accuracyMeters);
  const heading = numeric(payload?.heading);

  if (!dogId || latitude === null || longitude === null) {
    return NextResponse.json({ error: 'dogId, latitude, and longitude are required.' }, { status: 400 });
  }

  const dog = await prisma.dog.findFirst({
    where: { id: dogId, ownerId: user.id },
    select: { id: true, ownerId: true }
  });
  if (!dog) return NextResponse.json({ error: 'Dog not found.' }, { status: 404 });

  const routeMemoryId = typeof payload?.routeMemoryId === 'string' ? payload.routeMemoryId : null;
  const score = walkingConfidence({
    explicitStart: payload?.explicitStart === true || Boolean(walkId),
    speedMph,
    motionCadence: payload?.motionCadence === true,
    knownRouteMatch: Boolean(routeMemoryId),
    scheduledWindow: payload?.scheduledWindow === true,
    parkGeofence: payload?.parkGeofence === true,
    minutesSinceHeartbeat: 0
  });
  const status = presenceStatusFromScore(score, speedMph, 0);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 20 * 60 * 1000);
  const key = neighborhoodKey(latitude, longitude);

  const presence = await prisma.dogPresence.create({
    data: {
      dogId: dog.id,
      ownerId: dog.ownerId,
      walkId,
      routeMemoryId,
      latitude,
      longitude,
      speedMph,
      accuracyMeters,
      heading,
      walkingScore: score,
      status,
      neighborhoodKey: key,
      lastHeartbeatAt: now,
      expiresAt
    }
  });

  return NextResponse.json({
    ok: true,
    presence: {
      id: presence.id,
      dogId: presence.dogId,
      status: presence.status,
      walkingScore: presence.walkingScore,
      neighborhoodKey: presence.neighborhoodKey,
      expiresAt: presence.expiresAt.toISOString()
    }
  }, { status: 201 });
}
