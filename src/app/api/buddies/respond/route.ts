import { BuddyRequestStatus, NotificationType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { orderedBuddyPair } from '@/lib/buddies';
import { UI_ROUTES } from '@/lib/uiRoutes';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/auth/login', request.url));

  const formData = await request.formData();
  const requestId = String(formData.get('requestId') ?? '').trim();
  const action = String(formData.get('action') ?? '').trim();

  const buddyRequest = await prisma.buddyRequest.findUnique({
    where: { id: requestId },
    include: {
      sender: { select: { id: true, dogs: { select: { name: true }, orderBy: { createdAt: 'asc' }, take: 1 } } },
      receiver: { select: { id: true, dogs: { select: { name: true }, orderBy: { createdAt: 'asc' }, take: 1 } } }
    }
  });

  if (!buddyRequest) return NextResponse.redirect(new URL(`${UI_ROUTES.buddies}?error=request`, request.url));

  if (action === 'cancel' && buddyRequest.senderId === user.id) {
    await prisma.$transaction([
      prisma.buddyRequest.update({ where: { id: requestId }, data: { status: BuddyRequestStatus.CANCELLED, respondedAt: new Date() } }),
      prisma.notification.updateMany({ where: { buddyRequestId: requestId, readAt: null }, data: { readAt: new Date() } })
    ]);
    return NextResponse.redirect(new URL(`${UI_ROUTES.buddies}?cancelled=1`, request.url));
  }

  if (buddyRequest.receiverId !== user.id) {
    return NextResponse.redirect(new URL(`${UI_ROUTES.buddies}?error=unauthorized`, request.url));
  }

  const senderDogName = buddyRequest.sender.dogs[0]?.name ?? 'Your dog';
  const receiverDogName = buddyRequest.receiver.dogs[0]?.name ?? 'A dog';

  if (action === 'decline') {
    await prisma.$transaction(async (tx) => {
      await tx.buddyRequest.update({ where: { id: requestId }, data: { status: BuddyRequestStatus.DECLINED, respondedAt: new Date() } });
      await tx.notification.updateMany({ where: { buddyRequestId: requestId, readAt: null }, data: { readAt: new Date() } });
      await tx.notification.create({
        data: {
          userId: buddyRequest.senderId,
          type: NotificationType.BUDDY_REQUEST,
          routeKey: 'buddyRequests',
          href: UI_ROUTES.buddyRequests,
          title: `${receiverDogName} declined the buddy request`,
          body: `${senderDogName} and ${receiverDogName} were not connected.`,
          buddyRequestId: requestId
        }
      });
    });
    return NextResponse.redirect(new URL(`${UI_ROUTES.buddies}?declined=1`, request.url));
  }

  if (action === 'accept') {
    const pair = orderedBuddyPair(buddyRequest.senderId, buddyRequest.receiverId);
    await prisma.$transaction(async (tx) => {
      await tx.buddyRequest.update({ where: { id: requestId }, data: { status: BuddyRequestStatus.ACCEPTED, respondedAt: new Date() } });
      await tx.buddy.upsert({ where: { userAId_userBId: pair }, create: pair, update: {} });
      await tx.notification.updateMany({ where: { buddyRequestId: requestId, readAt: null }, data: { readAt: new Date() } });
      await tx.notification.create({
        data: {
          userId: buddyRequest.senderId,
          type: NotificationType.BUDDY_REQUEST,
          routeKey: 'buddyRequests',
          href: UI_ROUTES.buddies,
          title: `${receiverDogName} accepted the buddy request`,
          body: `${senderDogName} and ${receiverDogName} are now connected.`,
          buddyRequestId: requestId
        }
      });
    });
    return NextResponse.redirect(new URL(`${UI_ROUTES.buddies}?accepted=1`, request.url));
  }

  return NextResponse.redirect(new URL(`${UI_ROUTES.buddies}?error=action`, request.url));
}
