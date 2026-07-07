import { BuddyRequestStatus, NotificationType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, normalizeEmail } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { orderedBuddyPair } from '@/lib/buddies';
import { createNotification } from '@/lib/notifications';
import { UI_ROUTES } from '@/lib/uiRoutes';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/auth/login', request.url));

  const formData = await request.formData();
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  const note = String(formData.get('note') ?? '').trim() || null;

  if (!email || email === user.email) {
    return NextResponse.redirect(new URL('/dashboard/buddies?error=invalid', request.url));
  }

  const [receiver, senderDog] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.dog.findFirst({ where: { ownerId: user.id }, orderBy: { createdAt: 'asc' }, select: { name: true } })
  ]);
  if (!receiver) return NextResponse.redirect(new URL('/dashboard/buddies?error=not-found', request.url));

  const pair = orderedBuddyPair(user.id, receiver.id);
  const existingBuddy = await prisma.buddy.findUnique({ where: { userAId_userBId: pair }, select: { id: true } });
  if (existingBuddy) return NextResponse.redirect(new URL('/dashboard/buddies?error=exists', request.url));

  const reverse = await prisma.buddyRequest.findUnique({
    where: { senderId_receiverId: { senderId: receiver.id, receiverId: user.id } },
    select: { status: true }
  });

  if (reverse?.status === BuddyRequestStatus.PENDING) {
    return NextResponse.redirect(new URL('/dashboard/buddies?error=respond-first', request.url));
  }

  const buddyRequest = await prisma.buddyRequest.upsert({
    where: { senderId_receiverId: { senderId: user.id, receiverId: receiver.id } },
    create: { senderId: user.id, receiverId: receiver.id, message: note },
    update: { status: BuddyRequestStatus.PENDING, message: note, respondedAt: null }
  });

  await prisma.notification.updateMany({
    where: { userId: receiver.id, buddyRequestId: buddyRequest.id, readAt: null },
    data: { readAt: new Date() }
  });

  await createNotification({
    userId: receiver.id,
    type: NotificationType.BUDDY_REQUEST,
    routeKey: 'buddyRequests',
    href: UI_ROUTES.buddyRequests,
    title: `${senderDog?.name ?? 'A dog'} sent a buddy request`,
    body: note ?? 'Open Buddies to review the dog-to-dog request.',
    buddyRequestId: buddyRequest.id
  });

  return NextResponse.redirect(new URL('/dashboard/buddies?sent=1', request.url));
}
