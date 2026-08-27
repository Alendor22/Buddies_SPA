import { MapReportType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { realtimeChannels } from '@/lib/realtimeChannels';
import { publishRealtime } from '@/lib/realtimeServer';
import { neighborhoodKey } from '@/lib/socialMap';
import { socialMapRealtimeEvents, type SocialMapReportCreatedEvent } from '@/lib/socialMapRealtime';

export const dynamic = 'force-dynamic';

const REPORT_TITLES: Record<MapReportType, string> = {
  FRIENDLY_GROUP: 'Friendly dog group',
  LOOSE_DOG: 'Loose dog',
  AGGRESSIVE_DOG: 'Aggressive dog',
  WATER_BOWL: 'Water bowl',
  POOP_BAG_STATION: 'Poop bag station',
  HAZARD: 'Walk hazard',
  CROWDED_PARK: 'Crowded park',
  LOST_SIGHTING: 'Lost dog sighting'
};

function numeric(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function reportType(value: unknown) {
  return typeof value === 'string' && value in MapReportType ? value as MapReportType : null;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  const type = reportType(payload?.type);
  const latitude = numeric(payload?.latitude);
  const longitude = numeric(payload?.longitude);
  const dogId = typeof payload?.dogId === 'string' && payload.dogId.trim() ? payload.dogId.trim() : null;
  const body = typeof payload?.body === 'string' ? payload.body.trim().slice(0, 500) : null;

  if (!type || latitude === null || longitude === null) {
    return NextResponse.json({ error: 'type, latitude, and longitude are required.' }, { status: 400 });
  }

  if (dogId) {
    const dog = await prisma.dog.findFirst({ where: { id: dogId, ownerId: user.id }, select: { id: true } });
    if (!dog) return NextResponse.json({ error: 'Dog not found.' }, { status: 404 });
  }

  const expiresAt = new Date(Date.now() + 90 * 60 * 1000);
  const key = neighborhoodKey(latitude, longitude);
  const report = await prisma.mapReport.create({
    data: {
      reporterId: user.id,
      dogId,
      type,
      title: REPORT_TITLES[type],
      body,
      latitude,
      longitude,
      neighborhoodKey: key,
      expiresAt
    }
  });

  const realtimeEvent: SocialMapReportCreatedEvent = {
    neighborhoodKey: key,
    report: {
      id: report.id,
      type: report.type,
      title: report.title,
      latitude: report.latitude,
      longitude: report.longitude
    }
  };
  await publishRealtime(realtimeChannels.nearby(key), socialMapRealtimeEvents.reportCreated, realtimeEvent);

  return NextResponse.json({
    ok: true,
    report: {
      id: report.id,
      type: report.type,
      title: report.title,
      latitude: report.latitude,
      longitude: report.longitude,
      expiresAt: report.expiresAt.toISOString()
    }
  }, { status: 201 });
}
