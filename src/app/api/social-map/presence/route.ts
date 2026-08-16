import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { neighborhoodKey, presenceStatusFromScore, walkingConfidence } from '@/lib/socialMap';

export const dynamic = 'force-dynamic';

type DeviceLocInput = {
  lat?: unknown;
  lng?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  accuracy?: unknown;
  accuracyMeters?: unknown;
  speed?: unknown;
  speedMph?: unknown;
  heading?: unknown;
  altitude?: unknown;
  timestamp?: unknown;
};

function numeric(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDeviceLoc(payload: Record<string, unknown>) {
  const raw = (payload.device_loc && typeof payload.device_loc === 'object'
    ? payload.device_loc
    : {}) as DeviceLocInput;

  const latitude = numeric(raw.lat ?? raw.latitude ?? payload.latitude);
  const longitude = numeric(raw.lng ?? raw.longitude ?? payload.longitude);
  const accuracyMeters = numeric(raw.accuracyMeters ?? raw.accuracy ?? payload.accuracyMeters);
  const speedMph = numeric(raw.speedMph ?? payload.speedMph);
  const heading = numeric(raw.heading ?? payload.heading);
  const altitude = numeric(raw.altitude);
  const timestampValue = raw.timestamp;
  const timestamp = typeof timestampValue === 'string' || typeof timestampValue === 'number'
    ? new Date(timestampValue)
    : new Date();

  return {
    latitude,
    longitude,
    accuracyMeters,
    speedMph,
    heading,
    altitude,
    timestamp: Number.isNaN(timestamp.getTime()) ? new Date() : timestamp
  };
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!payload) return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });

  const dogId = String(payload.dogId ?? '').trim();
  const walkId = String(payload.walkId ?? '').trim() || null;
  const deviceLoc = normalizeDeviceLoc(payload);

  if (!dogId || deviceLoc.latitude === null || deviceLoc.longitude === null) {
    return NextResponse.json({ error: 'dogId and device_loc.lat/device_loc.lng are required.' }, { status: 400 });
  }

  if (deviceLoc.latitude < -90 || deviceLoc.latitude > 90 || deviceLoc.longitude < -180 || deviceLoc.longitude > 180) {
    return NextResponse.json({ error: 'device_loc coordinates are outside valid latitude/longitude bounds.' }, { status: 400 });
  }

  const dog = await prisma.dog.findFirst({
    where: { id: dogId, ownerId: user.id },
    select: { id: true, ownerId: true }
  });
  if (!dog) return NextResponse.json({ error: 'Dog not found.' }, { status: 404 });

  const routeMemoryId = typeof payload.routeMemoryId === 'string' ? payload.routeMemoryId : null;
  const score = walkingConfidence({
    explicitStart: payload.explicitStart === true || Boolean(walkId),
    speedMph: deviceLoc.speedMph,
    motionCadence: payload.motionCadence === true,
    knownRouteMatch: Boolean(routeMemoryId),
    scheduledWindow: payload.scheduledWindow === true,
    parkGeofence: payload.parkGeofence === true,
    minutesSinceHeartbeat: 0
  });
  const status = presenceStatusFromScore(score, deviceLoc.speedMph, 0);
  const now = deviceLoc.timestamp;
  const expiresAt = new Date(now.getTime() + 20 * 60 * 1000);
  const key = neighborhoodKey(deviceLoc.latitude, deviceLoc.longitude);

  const previous = await prisma.dogPresence.findUnique({
    where: { dogId: dog.id },
    select: { expiresAt: true }
  });
  const isNewSession = !previous || previous.expiresAt <= now;

  const presenceFields = {
    ownerId: dog.ownerId,
    walkId,
    routeMemoryId,
    latitude: deviceLoc.latitude,
    longitude: deviceLoc.longitude,
    speedMph: deviceLoc.speedMph,
    accuracyMeters: deviceLoc.accuracyMeters,
    heading: deviceLoc.heading,
    walkingScore: score,
    status,
    neighborhoodKey: key,
    lastHeartbeatAt: now,
    expiresAt,
    ...(isNewSession ? { startedAt: now } : {})
  };

  // Upsert on dogId: a heartbeat updates the dog's one live presence row rather than
  // inserting a new row every call, which would grow the table unboundedly. startedAt
  // resets when the prior session already expired, so it still reflects "this walk", not
  // whenever the dog's row was first ever created.
  const presence = await prisma.dogPresence.upsert({
    where: { dogId: dog.id },
    create: { dogId: dog.id, ...presenceFields },
    update: presenceFields
  });

  return NextResponse.json({
    ok: true,
    presence: {
      id: presence.id,
      dogId: presence.dogId,
      status: presence.status,
      walkingScore: presence.walkingScore,
      neighborhoodKey: presence.neighborhoodKey,
      device_loc: {
        lat: presence.latitude,
        lng: presence.longitude,
        accuracyMeters: presence.accuracyMeters,
        speedMph: presence.speedMph,
        heading: presence.heading,
        altitude: deviceLoc.altitude,
        timestamp: presence.lastHeartbeatAt.toISOString()
      },
      expiresAt: presence.expiresAt.toISOString()
    }
  }, { status: 201 });
}
