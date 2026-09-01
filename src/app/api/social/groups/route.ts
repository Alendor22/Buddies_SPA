import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createGroup, listGroups, addFeedItem } from '@/lib/social/repository';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  return NextResponse.json({ groups: await listGroups(user.id) });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const payload = await request.json().catch(() => null) as { name?: unknown; description?: unknown; city?: unknown } | null;
  const name = typeof payload?.name === 'string' ? payload.name.trim().slice(0, 80) : '';
  const description = typeof payload?.description === 'string' ? payload.description.trim().slice(0, 500) || null : null;
  const city = typeof payload?.city === 'string' ? payload.city.trim().slice(0, 80) || null : null;
  if (!name) return NextResponse.json({ error: 'Group name is required.' }, { status: 400 });
  const groupId = await createGroup(user.id, name, description, city);
  await addFeedItem(user.id, 'GROUP_CREATED', 'group', groupId);
  return NextResponse.json({ groupId }, { status: 201 });
}
