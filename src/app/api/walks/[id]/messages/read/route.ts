import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getWalkAccess } from '@/lib/walkAccess';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  void request;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const { id: walkId } = await context.params;
  const access = await getWalkAccess(walkId, user.id);
  if (!access) {
    return NextResponse.json({ error: 'Walk thread not found.' }, { status: 404 });
  }

  await prisma.notification.updateMany({
    where: {
      userId: user.id,
      walkId,
      routeKey: 'messages',
      readAt: null
    },
    data: { readAt: new Date() }
  });

  return NextResponse.json({ read: true });
}
