import { BuddyRequestStatus, NotificationType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { orderedBuddyPair, orderedDogBuddyPair } from '@/lib/buddies';
import { UI_ROUTES } from '@/lib/uiRoutes';

export const dynamic = 'force-dynamic';

function go(request: NextRequest, query: string) {
  return NextResponse.redirect(new URL(`${UI_ROUTES.buddies}?${query}`, request.url));
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/auth/login', request.url));

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

  if (action === 'cancel') {
    if (buddyRequest.senderDog.ownerId !== user.id) return go(request, 'error=unauthorized');

    await prisma.$transaction([
      prisma.dogBuddyRequest.update({
        where: { id: requestId },
        data: { status: BuddyRequestStatus.CANCELLED, respondedAt: new Date() }
      }),
      prisma.notification.updateMany({
        where: { dogBuddyRequestId: requestId, readAt: null },
        data: { readAt: new Date() }
      })
    ]);

    return go(request, 'cancelled=1');
  }

  if (buddyRequest.receiverDog.ownerId !== user.id) return go(request, 'error=unauthorized');

  if (action === 'decline') {
    await prisma.$transaction(async (tx) => {
      await tx.dogBuddyRequest.update({
        where: { id: requestId },
        data: { status: BuddyRequestStatus.DECLINED, respondedAt: new Date() }
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
          href: UI_ROUTES.buddyRequests,
          title: `${buddyRequest.receiverDog.name} declined ${buddyRequest.senderDog.name}'s buddy request`,
          body: 'The dog profiles were not connected.',
          dogId: buddyRequest.senderDog.id,
          dogBuddyRequestId: requestId
        }
      });
    });

    return go(request, 'declined=1');
  }

  if (action === 'accept') {
    const dogPair = orderedDogBuddyPair(buddyRequest.senderDog.id, buddyRequest.receiverDog.id);
    const ownerPair = orderedBuddyPair(buddyRequest.senderDog.ownerId, buddyRequest.receiverDog.ownerId);

    await prisma.$transaction(async (tx) => {
      await tx.dogBuddyRequest.update({
        where: { id: requestId },
        data: { status: BuddyRequestStatus.ACCEPTED, respondedAt: new Date() }
      });
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
    });

    return go(request, 'accepted=1');
  }

  return go(request, 'error=action');
}
