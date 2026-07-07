import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { UI_ROUTES } from '@/lib/uiRoutes';

export const dynamic = 'force-dynamic';

function safeReturnTo(value: string) {
  return value.startsWith('/') && !value.startsWith('//') ? value : UI_ROUTES.alerts;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/auth/login', request.url));

  const formData = await request.formData();
  const notificationId = String(formData.get('notificationId') ?? '').trim();
  const routeKey = String(formData.get('routeKey') ?? '').trim();
  const markAll = String(formData.get('all') ?? '') === '1';
  const returnTo = safeReturnTo(String(formData.get('returnTo') ?? UI_ROUTES.alerts));

  if (markAll) {
    await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  } else if (notificationId) {
    await prisma.notification.updateMany({ where: { id: notificationId, userId: user.id, readAt: null }, data: { readAt: new Date() } });
  } else if (routeKey) {
    await prisma.notification.updateMany({ where: { routeKey, userId: user.id, readAt: null }, data: { readAt: new Date() } });
  }

  return NextResponse.redirect(new URL(returnTo, request.url));
}
