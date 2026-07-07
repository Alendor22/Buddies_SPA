import { NotificationType, WalkInvitationStatus, WalkStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { dogWalkInvitesRoute, UI_ROUTES } from '@/lib/uiRoutes';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/auth/login', request.url));

  const formData = await request.formData();
  const invitationId = String(formData.get('invitationId') ?? '').trim();
  const action = String(formData.get('action') ?? '').trim();

  if (!invitationId || !['accept', 'decline', 'cancel'].includes(action)) {
    return NextResponse.redirect(new URL(`${UI_ROUTES.buddies}?error=walk-invalid`, request.url));
  }

  const invitation = await prisma.walkInvitation.findUnique({
    where: { id: invitationId },
    include: {
      senderDog: { select: { id: true, name: true, slug: true, ownerId: true } },
      invitedDog: { select: { id: true, name: true, slug: true, ownerId: true } },
      walk: { select: { id: true } }
    }
  });

  if (!invitation) return NextResponse.redirect(new URL(`${UI_ROUTES.buddies}?error=walk-invalid`, request.url));

  const isRecipient = invitation.invitedDog.ownerId === user.id;
  const isSender = invitation.senderDog.ownerId === user.id;
  if ((action === 'cancel' && !isSender) || (action !== 'cancel' && !isRecipient)) {
    return NextResponse.redirect(new URL(`${UI_ROUTES.buddies}?error=walk-invalid`, request.url));
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

  await prisma.$transaction(async (tx) => {
    await tx.walkInvitation.update({
      where: { id: invitation.id },
      data: { status: invitationStatus, respondedAt: new Date() }
    });
    await tx.walk.update({ where: { id: invitation.walk.id }, data: { status: walkStatus } });
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
  });

  return NextResponse.redirect(new URL(`${UI_ROUTES.buddies}?${action}=1#walk-invitations`, request.url));
}
