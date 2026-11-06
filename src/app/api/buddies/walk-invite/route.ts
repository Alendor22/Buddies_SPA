import { NotificationType } from '@/generated/prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, normalizeEmail } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { orderedDogBuddyPair } from '@/lib/buddies';
import { dogWalkInvitesRoute, UI_ROUTES } from '@/lib/uiRoutes';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/auth/login', request.url), 303);

  const formData = await request.formData();
  const connection = String(formData.get('connection') ?? '').trim();
  const [connectionSenderDogId = '', connectionInvitedDogId = ''] = connection.split(':');
  const senderDogId = String(formData.get('dogId') ?? connectionSenderDogId).trim();
  const invitedDogId = String(formData.get('invitedDogId') ?? connectionInvitedDogId).trim();
  const legacyEmail = normalizeEmail(String(formData.get('email') ?? ''));
  const startsAtRaw = String(formData.get('startsAt') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim().slice(0, 500) || null;

  if (!senderDogId || !startsAtRaw || (!invitedDogId && !legacyEmail)) {
    return NextResponse.redirect(new URL(`${UI_ROUTES.buddies}?error=walk-invalid`, request.url), 303);
  }

  const senderDog = await prisma.dog.findFirst({
    where: { id: senderDogId, ownerId: user.id },
    select: { id: true, name: true, breed: true, slug: true, ownerId: true }
  });
  if (!senderDog) return NextResponse.redirect(new URL(`${UI_ROUTES.buddies}?error=walk-invalid`, request.url), 303);

  const invitedDog = invitedDogId
    ? await prisma.dog.findUnique({ where: { id: invitedDogId }, select: { id: true, name: true, breed: true, slug: true, ownerId: true } })
    : await prisma.dog.findFirst({ where: { owner: { email: legacyEmail } }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, breed: true, slug: true, ownerId: true } });

  if (!invitedDog || invitedDog.ownerId === user.id) {
    return NextResponse.redirect(new URL(`${UI_ROUTES.buddies}?error=walk-invalid`, request.url), 303);
  }

  const dogPair = orderedDogBuddyPair(senderDog.id, invitedDog.id);
  const dogBuddy = await prisma.dogBuddy.findUnique({
    where: { dogAId_dogBId: dogPair },
    select: { id: true }
  });
  if (!dogBuddy) return NextResponse.redirect(new URL(`${UI_ROUTES.buddies}?error=not-dog-buddies`, request.url), 303);

  const startsAt = new Date(startsAtRaw);
  const earliestAllowed = Date.now() - 5 * 60_000;
  if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() < earliestAllowed) {
    return NextResponse.redirect(new URL(`${UI_ROUTES.buddies}?error=walk-time`, request.url), 303);
  }

  const result = await prisma.$transaction(async (tx) => {
    const walk = await tx.walk.create({
      data: {
        dogId: senderDog.id,
        requesterId: user.id,
        walkerId: null,
        startsAt,
        durationMin: 30,
        notes: note
      }
    });

    const invitation = await tx.walkInvitation.create({
      data: {
        walkId: walk.id,
        senderDogId: senderDog.id,
        invitedDogId: invitedDog.id,
        message: note
      }
    });

    await tx.notification.create({
      data: {
        userId: invitedDog.ownerId,
        type: NotificationType.WALK_INVITE,
        routeKey: 'walkInvites',
        href: dogWalkInvitesRoute(invitedDog.slug),
        title: `${senderDog.name} invited ${invitedDog.name} to a walk`,
        body: `${startsAt.toLocaleString()}${note ? ` · ${note}` : ''}`,
        dogId: invitedDog.id,
        walkId: walk.id,
        walkInvitationId: invitation.id
      }
    });

    return invitation;
  });

  return NextResponse.redirect(new URL(`${UI_ROUTES.buddies}?walk=sent&dog=${encodeURIComponent(senderDog.name)}&invited=${encodeURIComponent(invitedDog.name)}&inviteId=${result.id}`, request.url), 303);
}
