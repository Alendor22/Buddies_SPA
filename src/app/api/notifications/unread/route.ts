import { NextResponse } from 'next/server';
import { NotificationType } from '@/generated/prisma/client';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ count: 0 }, { status: 401 });
  const where = { userId: user.id, readAt: null };
  const [count, messageCount] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { ...where, type: NotificationType.MESSAGE } })
  ]);
  return NextResponse.json({ count, messageCount });
}
