import { NotificationType, WalkInvitationStatus, WalkStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { UI_ROUTES } from '@/lib/uiRoutes';

export const dynamic = 'force-dynamic';

type WalkAction = 'start' | 'complete' | 'cancel';

function isWalkAction(value: string): value is WalkAction {
  return value === 'start' || value === 'complete' || value === 'cancel';
}

function targetStatus(action: WalkAction): WalkStatus {
  if (action === 'start') return WalkStatus.ACTIVE;
  if (action === 'complete') return WalkStatus.COMPLETED;
  return WalkStatus.CANCELLED;
}

function canTransition(current: WalkStatus, action: WalkAction) {
  if (action === 'start') return current === WalkStatus.ACCEPTED;
  if (action === 'complete') return current === WalkStatus.ACTIVE;
  return current === WalkStatus.REQUESTED
    || current === WalkStatus.ACCEPTED
    || current === WalkStatus.ACTIVE;
}

function statusTitle(dogName: string, action: WalkAction) {
  if (action === 'start') return `${dogName}'s walk started`;
  if (action === 'complete') return `${dogName}'s walk was completed`;
  return `${dogName}'s walk was cancelled`;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/auth/login', request.url));

  const formData = await request.formData();
  const walkId = String(formData.get('walkId') ?? '').trim();
  const actionValue = String(formData.get('action') ?? '').trim();

  if (!walkId || !isWalkAction(actionValue)) {
    return NextResponse.redirect(new URL(`${UI_ROUTES.walks}?error=action`, request.url));
  }
  const action = actionValue;

  const walk = await prisma.walk.findUnique({
    where: { id: walkId },
    include: {
      dog: { select: { id: true, name: true, slug: true, ownerId: true } },
      invitations: {
        include: {
          senderDog: { select: { ownerId: true } },
          invitedDog: { select: { ownerId: true } }
        }
      }
    }
  });

  if (!walk) return NextResponse.redirect(new URL(`${UI_ROUTES.walks}?error=walk`, request.url));

  const participantIds = new Set<string>([walk.requesterId, walk.dog.ownerId]);
  if (walk.walkerId) participantIds.add(walk.walkerId);
  for (const invitation of walk.invitations) {
    participantIds.add(invitation.senderDog.ownerId);
    participantIds.add(invitation.invitedDog.ownerId);
  }

  if (!participantIds.has(user.id)) {
    return NextResponse.redirect(new URL(`${UI_ROUTES.walks}?error=unauthorized`, request.url));
  }

  if (!canTransition(walk.status, action)) {
    return NextResponse.redirect(new URL(`${UI_ROUTES.walks}?error=transition`, request.url));
  }

  const nextStatus = targetStatus(action);
  const notificationRecipients = Array.from(participantIds).filter((id) => id !== user.id);

  await prisma.$transaction(async (tx) => {
    await tx.walk.update({ where: { id: walk.id }, data: { status: nextStatus } });

    if (action === 'cancel') {
      await tx.walkInvitation.updateMany({
        where: { walkId: walk.id, status: WalkInvitationStatus.PENDING },
        data: { status: WalkInvitationStatus.CANCELLED, respondedAt: new Date() }
      });
    }

    await tx.notification.updateMany({
      where: { userId: user.id, walkId: walk.id, readAt: null },
      data: { readAt: new Date() }
    });

    for (const recipientId of notificationRecipients) {
      await tx.notification.create({
        data: {
          userId: recipientId,
          type: NotificationType.WALK_STATUS,
          routeKey: 'walkInvites',
          href: `${UI_ROUTES.walks}#walk-${walk.id}`,
          title: statusTitle(walk.dog.name, action),
          body: `Status: ${nextStatus}`,
          dogId: walk.dog.id,
          walkId: walk.id
        }
      });
    }
  });

  return NextResponse.redirect(new URL(`${UI_ROUTES.walks}?updated=${nextStatus.toLowerCase()}#walk-${walk.id}`, request.url));
}
