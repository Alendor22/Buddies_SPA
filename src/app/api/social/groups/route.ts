import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createGroup, listGroups, addFeedItem, listBlockedUserIds } from '@/lib/social/repository';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  return NextResponse.json({ groups: await listGroups(user.id) });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const payload = await request.json().catch(() => null) as { action?: unknown; groupId?: unknown; name?: unknown; description?: unknown; city?: unknown } | null;
  if (payload?.action === 'join' || payload?.action === 'leave') {
    const groupId = typeof payload.groupId === 'string' ? payload.groupId : '';
    if (!groupId) return NextResponse.json({ error: 'Choose a public group.' }, { status: 400 });
    const group = await prisma.socialGroup.findFirst({ where: { id: groupId, visibility: 'PUBLIC' }, select: { id: true, ownerId: true } });
    if (!group) return NextResponse.json({ error: 'That public group is unavailable.' }, { status: 404 });
    if (payload.action === 'join') {
      const blocked = await listBlockedUserIds(user.id);
      if (blocked.includes(group.ownerId)) return NextResponse.json({ error: 'You cannot subscribe to this group.' }, { status: 403 });
      await prisma.socialGroupMember.upsert({
        where: { groupId_userId: { groupId, userId: user.id } },
        create: { groupId, userId: user.id, role: 'MEMBER' },
        update: {}
      });
      await addFeedItem(user.id, 'GROUP_MEMBER_JOINED', 'group', groupId);
      return NextResponse.json({ joined: true }, { status: 200 });
    }
    if (group.ownerId === user.id) return NextResponse.json({ error: 'A group owner cannot unsubscribe from their own group.' }, { status: 409 });
    await prisma.socialGroupMember.deleteMany({ where: { groupId, userId: user.id } });
    return NextResponse.json({ joined: false }, { status: 200 });
  }
  const name = typeof payload?.name === 'string' ? payload.name.trim().slice(0, 80) : '';
  const description = typeof payload?.description === 'string' ? payload.description.trim().slice(0, 500) || null : null;
  const city = typeof payload?.city === 'string' ? payload.city.trim().slice(0, 80) || null : null;
  if (!name) return NextResponse.json({ error: 'Group name is required.' }, { status: 400 });
  const groupId = await createGroup(user.id, name, description, city);
  await addFeedItem(user.id, 'GROUP_CREATED', 'group', groupId);
  return NextResponse.json({ groupId }, { status: 201 });
}
