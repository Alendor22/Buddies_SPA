import { BuddyRequestStatus, NotificationType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { orderedBuddyPair, orderedDogBuddyPair } from '@/lib/buddies';
import { UI_ROUTES } from '@/lib/uiRoutes';

export const dynamic = 'force-dynamic';

function go(request: NextRequest, query: string) {
  return NextResponse.redirect(new URL(`${UI_ROUTES.buddies}?${query}`, request.url), 303);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/auth/login', request.url), 303);

  const formData = await request.formData();
  const requestId = String(formData.get('requestId') ?? '').trim();
  const action = String(formData.get('action') ?? '').trim();

  const buddyRequest = await prisma.dogBuddyRequest.findUnique({
    where: { id: requestId },
    include: {
      senderDog: { select: { id: true, name: true, ownerId: true } },
      receiverDog: { select: { id: true, name: true, ownerId: true } }
    }
  });

  if (!buddyRequest) return go(request, 'error=request');
  if (buddyRequest.status !== BuddyRequestStatus.PENDING) return go(request, 'error=request-resolved');

  if (action === 'cancel') {
    if (buddyRequest.senderDog.ownerId !== user.id) return go(request, 'error=unauthorized');

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.dogBuddyRequest.updateMany({
        where: { id: requestId, status: BuddyRequestStatus.PENDING },
        data: { status: BuddyRequestStatus.CANCELLED, respondedAt: new Date() }
      });
      if (!result.count) return false;
      await tx.notification.updateMany({
        where: { dogBuddyRequestId: requestId, readAt: null },
        data: { readAt: new Date() }
      });
      return true;
    });

    return go(request, updated ? 'cancelled=1' : 'error=request-resolved');
  }

  if (buddyRequest.receiverDog.ownerId !== user.id) return go(request, 'error=unauthorized');

  if (action === 'decline') {
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.dogBuddyRequest.updateMany({
        where: { id: requestId, status: BuddyRequestStatus.PENDING },
        data: { status: BuddyRequestStatus.DECLINED, respondedAt: new Date() }
      });
      if (!result.count) return false;
      await tx.notification.updateMany({
        where: { dogBuddyRequestId: requestId, readAt: null },
        data: { readAt: new Date() }
      });
      await tx.notification.create({
        data: {
          userId: buddyRequest.senderDog.ownerId,
          type: NotificationType.BUDDY_REQUEST,
          routeKey: 'buddyRequests',
          href: UI_ROUTES.buddyRequests,
          title: `${buddyRequest.receiverDog.name} declined ${buddyRequest.senderDog.name}'s buddy request`,
          body: 'The dog profiles were not connected.',
          dogId: buddyRequest.senderDog.id,
          dogBuddyRequestId: requestId
        }
      });
      return true;
    });

    return go(request, updated ? 'declined=1' : 'error=request-resolved');
  }

  if (action === 'accept') {
    const dogPair = orderedDogBuddyPair(buddyRequest.senderDog.id, buddyRequest.receiverDog.id);
    const ownerPair = orderedBuddyPair(buddyRequest.senderDog.ownerId, buddyRequest.receiverDog.ownerId);

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.dogBuddyRequest.updateMany({
        where: { id: requestId, status: BuddyRequestStatus.PENDING },
        data: { status: BuddyRequestStatus.ACCEPTED, respondedAt: new Date() }
      });
      if (!result.count) return false;
      await tx.dogBuddy.upsert({
        where: { dogAId_dogBId: dogPair },
        create: dogPair,
        update: {}
      });
      await tx.buddy.upsert({
        where: { userAId_userBId: ownerPair },
        create: ownerPair,
        update: {}
      });
      await tx.notification.updateMany({
        where: { dogBuddyRequestId: requestId, readAt: null },
        data: { readAt: new Date() }
      });
      await tx.notification.create({
        data: {
          userId: buddyRequest.senderDog.ownerId,
          type: NotificationType.BUDDY_REQUEST,
          routeKey: 'buddyRequests',
          href: UI_ROUTES.buddies,
          title: `${buddyRequest.receiverDog.name} accepted ${buddyRequest.senderDog.name}'s buddy request`,
          body: `${buddyRequest.senderDog.name} and ${buddyRequest.receiverDog.name} are now buddies.`,
          dogId: buddyRequest.senderDog.id,
          dogBuddyRequestId: requestId
        }
      });
      return true;
    });

    return go(request, updated ? 'accepted=1' : 'error=request-resolved');
  }

  return go(request, 'error=action');
}
