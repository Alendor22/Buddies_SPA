import { NotificationType, WalkInvitationStatus, WalkStatus } from '@/generated/prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { UI_ROUTES } from '@/lib/uiRoutes';

export const dynamic = 'force-dynamic';

type WalkAction = 'start' | 'complete' | 'cancel';

function isWalkAction(value: string): value is WalkAction {
  return value === 'start' || value === 'complete' || value === 'cancel';
}

function targetStatus(action: WalkAction) {
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
  if (!user) return NextResponse.redirect(new URL('/auth/login', request.url), 303);

  const formData = await request.formData();
  const walkId = String(formData.get('walkId') ?? '').trim();
  const actionValue = String(formData.get('action') ?? '').trim();
  if (!walkId || !isWalkAction(actionValue)) {
    return NextResponse.redirect(new URL(`${UI_ROUTES.walks}?error=action`, request.url), 303);
  }

  const walk = await prisma.walk.findUnique({
    where: { id: walkId },
    include: {
      dog: { select: { id: true, name: true, ownerId: true } },
      invitations: {
        include: {
          senderDog: { select: { ownerId: true } },
          invitedDog: { select: { ownerId: true } }
        }
      }
    }
  });
  if (!walk) return NextResponse.redirect(new URL(`${UI_ROUTES.walks}?error=walk`, request.url), 303);

  const accepted = walk.invitations.filter((invite) => invite.status === WalkInvitationStatus.ACCEPTED);
  const acceptedWalkerIds = new Set(accepted.map((invite) => invite.invitedDog.ownerId));
  const participants = new Set<string>([walk.requesterId, walk.dog.ownerId]);

  if (walk.walkerId && (!walk.invitations.length || acceptedWalkerIds.has(walk.walkerId))) participants.add(walk.walkerId);
  for (const invite of accepted) {
    participants.add(invite.senderDog.ownerId);
    participants.add(invite.invitedDog.ownerId);
  }

  if (!participants.has(user.id)) {
    return NextResponse.redirect(new URL(`${UI_ROUTES.walks}?error=unauthorized`, request.url), 303);
  }
  if (!canTransition(walk.status, actionValue)) {
    return NextResponse.redirect(new URL(`${UI_ROUTES.walks}?error=transition`, request.url), 303);
  }

  const nextStatus = targetStatus(actionValue);
  const recipients = Array.from(participants).filter((id) => id !== user.id);

  await prisma.$transaction(async (tx) => {
    await tx.walk.update({ where: { id: walk.id }, data: { status: nextStatus } });
    if (actionValue === 'cancel') {
      await tx.walkInvitation.updateMany({
        where: { walkId: walk.id, status: WalkInvitationStatus.PENDING },
        data: { status: WalkInvitationStatus.CANCELLED, respondedAt: new Date() }
      });
    }
    await tx.notification.updateMany({
      where: { userId: user.id, walkId: walk.id, readAt: null },
      data: { readAt: new Date() }
    });
    for (const recipientId of recipients) {
      await tx.notification.create({
        data: {
          userId: recipientId,
          type: NotificationType.WALK_STATUS,
          routeKey: 'walkInvites',
          href: `${UI_ROUTES.walks}#walk-${walk.id}`,
          title: statusTitle(walk.dog.name, actionValue),
          body: `Status: ${nextStatus}`,
          dogId: walk.dog.id,
          walkId: walk.id
        }
      });
    }
  });

  return NextResponse.redirect(new URL(`${UI_ROUTES.walks}?updated=${nextStatus.toLowerCase()}#walk-${walk.id}`, request.url), 303);
}
