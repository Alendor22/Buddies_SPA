import { NotificationType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, normalizeEmail } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { orderedBuddyPair } from '@/lib/buddies';
import { dogWalkInvitesRoute } from '@/lib/uiRoutes';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/auth/login', request.url));

  const formData = await request.formData();
  const senderDogId = String(formData.get('dogId') ?? '').trim();
  const invitedDogId = String(formData.get('invitedDogId') ?? '').trim();
  const legacyEmail = normalizeEmail(String(formData.get('email') ?? ''));
  const startsAtRaw = String(formData.get('startsAt') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim() || null;

  if (!senderDogId || !startsAtRaw || (!invitedDogId && !legacyEmail)) {
    return NextResponse.redirect(new URL('/dashboard/buddies?error=walk-invalid', request.url));
  }

  const senderDog = await prisma.dog.findFirst({
    where: { id: senderDogId, ownerId: user.id },
    select: { id: true, name: true, breed: true, slug: true }
  });
  if (!senderDog) return NextResponse.redirect(new URL('/dashboard/buddies?error=walk-invalid', request.url));

  const invitedDog = invitedDogId
    ? await prisma.dog.findUnique({ where: { id: invitedDogId }, select: { id: true, name: true, breed: true, slug: true, ownerId: true } })
    : await prisma.dog.findFirst({ where: { owner: { email: legacyEmail } }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, breed: true, slug: true, ownerId: true } });

  if (!invitedDog || invitedDog.ownerId === user.id) {
    return NextResponse.redirect(new URL('/dashboard/buddies?error=walk-invalid', request.url));
  }

  const pair = orderedBuddyPair(user.id, invitedDog.ownerId);
  const buddy = await prisma.buddy.findUnique({ where: { userAId_userBId: pair }, select: { id: true } });
  if (!buddy) return NextResponse.redirect(new URL('/dashboard/buddies?error=exists', request.url));

  const startsAt = new Date(startsAtRaw);
  if (Number.isNaN(startsAt.getTime())) {
    return NextResponse.redirect(new URL('/dashboard/buddies?error=walk-invalid', request.url));
  }

  const result = await prisma.$transaction(async (tx) => {
    const walk = await tx.walk.create({
      data: {
        dogId: senderDog.id,
        requesterId: user.id,
        walkerId: invitedDog.ownerId,
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

    return { walk, invitation };
  });

  return NextResponse.redirect(new URL(`/dashboard/buddies?walk=sent&dog=${encodeURIComponent(senderDog.name)}&invited=${encodeURIComponent(invitedDog.name)}&inviteId=${result.invitation.id}`, request.url));
}
