import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { addFeedItem, createEvent, listEvents } from '@/lib/social/repository';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  return NextResponse.json({ events: await listEvents(user.id) });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const payload = await request.json().catch(() => null) as { title?: unknown; description?: unknown; locationName?: unknown; startsAt?: unknown } | null;
  const title = typeof payload?.title === 'string' ? payload.title.trim().slice(0, 120) : '';
  const description = typeof payload?.description === 'string' ? payload.description.trim().slice(0, 1000) || null : null;
  const locationName = typeof payload?.locationName === 'string' ? payload.locationName.trim().slice(0, 160) || null : null;
  const startsAt = typeof payload?.startsAt === 'string' ? new Date(payload.startsAt) : new Date(NaN);
  if (!title || Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: 'A title and future start time are required.' }, { status: 400 });
  }
  const eventId = await createEvent(user.id, title, startsAt, description, locationName);
  await addFeedItem(user.id, 'EVENT_CREATED', 'event', eventId);
  return NextResponse.json({ eventId }, { status: 201 });
}
