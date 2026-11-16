import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import { addFeedItem, createEvent, listEvents } from '@/lib/social/repository';

export const dynamic = 'force-dynamic';

const createEventSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().max(1000).optional().nullable(),
  locationName: z.string().max(160).optional().nullable(),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }).optional().nullable(),
  packId: z.string().min(1).optional().nullable(),
  latitude: z.number().finite().min(-90).max(90).optional().nullable(),
  longitude: z.number().finite().min(-180).max(180).optional().nullable()
}).refine((value) => (value.latitude == null) === (value.longitude == null), { message: 'Both coordinates must be provided together.' });

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  return NextResponse.json({ events: await listEvents(user.id) });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const limit = await rateLimit('social:events:create', user.id, 10, 3600);
  if (!limit.allowed) return NextResponse.json({ error: 'Too many meetups created recently. Try again shortly.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } });
  const parsed = createEventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Provide a title, valid future time, and valid meetup details.' }, { status: 400 });
  const payload = parsed.data;
  const title = payload.title.trim();
  const description = payload.description?.trim().slice(0, 1000) || null;
  const locationName = payload.locationName?.trim().slice(0, 160) || null;
  const startsAt = new Date(payload.startsAt);
  const endsAt = payload.endsAt ? new Date(payload.endsAt) : null;
  const packId = payload.packId || null;
  const latitude = payload.latitude ?? null;
  const longitude = payload.longitude ?? null;
  if (startsAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: 'A title and future start time are required.' }, { status: 400 });
  }
  if (endsAt && endsAt <= startsAt) {
    return NextResponse.json({ error: 'The meetup end time must be later than its start time.' }, { status: 400 });
  }
  if (packId) {
    const membership = await prisma.dogPack.findFirst({
      where: {
        id: packId,
        OR: [
          { ownerId: user.id },
          { members: { some: {
            status: 'ACCEPTED',
            OR: [
              { userId: user.id },
              { dog: { custodians: { some: { userId: user.id, role: { in: ['OWNER', 'CAREGIVER'] } } } } }
            ]
          } } }
        ]
      },
      select: { id: true }
    });
    if (!membership) return NextResponse.json({ error: 'You must be a pack creator or member to host its meetup.' }, { status: 403 });
    const acceptedDogs = await prisma.dogPackMember.count({ where: { packId, status: 'ACCEPTED' } });
    if (acceptedDogs < 3) return NextResponse.json({ error: 'A pack needs at least three accepted dogs before it can host a meetup.' }, { status: 409 });
  }
  const eventId = await createEvent(user.id, title, startsAt, description, locationName, {
    packId,
    endsAt,
    latitude,
    longitude
  });
  await addFeedItem(user.id, 'EVENT_CREATED', 'event', eventId);
  return NextResponse.json({ eventId }, { status: 201 });
}
