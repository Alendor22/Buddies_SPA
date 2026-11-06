import { NotificationType, WalkInvitationStatus, WalkStatus } from '@/generated/prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { dogWalkInvitesRoute, UI_ROUTES } from '@/lib/uiRoutes';

export const dynamic = 'force-dynamic';

function go(request: NextRequest, query: string) {
  return NextResponse.redirect(new URL(`${UI_ROUTES.buddies}?${query}#walk-invitations`, request.url), 303);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/auth/login', request.url), 303);

  const formData = await request.formData();
  const invitationId = String(formData.get('invitationId') ?? '').trim();
  const action = String(formData.get('action') ?? '').trim();

  if (!invitationId || !['accept', 'decline', 'cancel'].includes(action)) {
    return go(request, 'error=walk-invalid');
  }

  const invitation = await prisma.walkInvitation.findUnique({
    where: { id: invitationId },
    include: {
      senderDog: { select: { id: true, name: true, slug: true, ownerId: true } },
      invitedDog: { select: { id: true, name: true, slug: true, ownerId: true } },
      walk: { select: { id: true } }
    }
  });

  if (!invitation) return go(request, 'error=walk-invalid');
  if (invitation.status !== WalkInvitationStatus.PENDING) return go(request, 'error=walk-resolved');

  const isRecipient = invitation.invitedDog.ownerId === user.id;
  const isSender = invitation.senderDog.ownerId === user.id;
  if ((action === 'cancel' && !isSender) || (action !== 'cancel' && !isRecipient)) {
    return go(request, 'error=walk-unauthorized');
  }

  const invitationStatus = action === 'accept'
    ? WalkInvitationStatus.ACCEPTED
    : action === 'decline'
      ? WalkInvitationStatus.DECLINED
      : WalkInvitationStatus.CANCELLED;
  const walkStatus = action === 'accept' ? WalkStatus.ACCEPTED : WalkStatus.CANCELLED;
  const actorDog = isRecipient ? invitation.invitedDog : invitation.senderDog;
  const recipientOwnerId = isRecipient ? invitation.senderDog.ownerId : invitation.invitedDog.ownerId;
  const recipientDog = isRecipient ? invitation.senderDog : invitation.invitedDog;

  const updated = await prisma.$transaction(async (tx) => {
    const invitationUpdate = await tx.walkInvitation.updateMany({
      where: { id: invitation.id, status: WalkInvitationStatus.PENDING },
      data: { status: invitationStatus, respondedAt: new Date() }
    });
    if (!invitationUpdate.count) return false;

    await tx.walk.update({
      where: { id: invitation.walk.id },
      data: {
        status: walkStatus,
        walkerId: action === 'accept' ? invitation.invitedDog.ownerId : null
      }
    });
    await tx.notification.updateMany({
      where: { walkInvitationId: invitation.id, userId: user.id, readAt: null },
      data: { readAt: new Date() }
    });
    await tx.notification.create({
      data: {
        userId: recipientOwnerId,
        type: NotificationType.WALK_STATUS,
        routeKey: 'walkInvites',
        href: dogWalkInvitesRoute(recipientDog.slug),
        title: `${actorDog.name} ${action === 'accept' ? 'accepted' : action === 'decline' ? 'declined' : 'cancelled'} the walk invitation`,
        body: `${invitation.senderDog.name} → ${invitation.invitedDog.name}`,
        dogId: recipientDog.id,
        walkId: invitation.walk.id,
        walkInvitationId: invitation.id
      }
    });
    return true;
  });

  if (!updated) return go(request, 'error=walk-resolved');
  return go(request, `${action}=1`);
}
