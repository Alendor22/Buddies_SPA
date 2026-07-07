import { BuddyRequestStatus, NotificationType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, normalizeEmail } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { orderedDogBuddyPair } from '@/lib/buddies';
import { UI_ROUTES } from '@/lib/uiRoutes';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/auth/login', request.url));

  const formData = await request.formData();
  const senderDogId = String(formData.get('senderDogId') ?? '').trim();
  const receiverDogId = String(formData.get('receiverDogId') ?? '').trim();
  const legacyEmail = normalizeEmail(String(formData.get('email') ?? ''));
  const note = String(formData.get('note') ?? '').trim() || null;

  const senderDog = senderDogId
    ? await prisma.dog.findFirst({ where: { id: senderDogId, ownerId: user.id }, select: { id: true, name: true, slug: true, ownerId: true } })
    : await prisma.dog.findFirst({ where: { ownerId: user.id }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, slug: true, ownerId: true } });

  const receiverDog = receiverDogId
    ? await prisma.dog.findUnique({ where: { id: receiverDogId }, select: { id: true, name: true, slug: true, ownerId: true } })
    : legacyEmail
      ? await prisma.dog.findFirst({ where: { owner: { email: legacyEmail } }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, slug: true, ownerId: true } })
      : null;

  if (!senderDog || !receiverDog || receiverDog.ownerId === user.id) {
    return NextResponse.redirect(new URL(`${UI_ROUTES.buddies}?error=invalid`, request.url));
  }

  const pair = orderedDogBuddyPair(senderDog.id, receiverDog.id);
  const existingBuddy = await prisma.dogBuddy.findUnique({
    where: { dogAId_dogBId: pair },
    select: { id: true }
  });
  if (existingBuddy) return NextResponse.redirect(new URL(`${UI_ROUTES.buddies}?error=exists`, request.url));

  const reverse = await prisma.dogBuddyRequest.findUnique({
    where: {
      senderDogId_receiverDogId: {
        senderDogId: receiverDog.id,
        receiverDogId: senderDog.id
      }
    },
    select: { status: true }
  });

  if (reverse?.status === BuddyRequestStatus.PENDING) {
    return NextResponse.redirect(new URL(`${UI_ROUTES.buddies}?error=respond-first`, request.url));
  }

  const buddyRequest = await prisma.dogBuddyRequest.upsert({
    where: {
      senderDogId_receiverDogId: {
        senderDogId: senderDog.id,
        receiverDogId: receiverDog.id
      }
    },
    create: {
      senderDogId: senderDog.id,
      receiverDogId: receiverDog.id,
      message: note
    },
    update: {
      status: BuddyRequestStatus.PENDING,
      message: note,
      respondedAt: null
    }
  });

  await prisma.notification.updateMany({
    where: {
      userId: receiverDog.ownerId,
      dogBuddyRequestId: buddyRequest.id,
      readAt: null
    },
    data: { readAt: new Date() }
  });

  await prisma.notification.create({
    data: {
      userId: receiverDog.ownerId,
      type: NotificationType.BUDDY_REQUEST,
      routeKey: 'buddyRequests',
      href: UI_ROUTES.buddyRequests,
      title: `${senderDog.name} sent ${receiverDog.name} a buddy request`,
      body: note ?? 'Open Buddies to review the dog-to-dog request.',
      dogId: receiverDog.id,
      dogBuddyRequestId: buddyRequest.id
    }
  });

  return NextResponse.redirect(new URL(`${UI_ROUTES.buddies}?sent=1&from=${encodeURIComponent(senderDog.name)}&to=${encodeURIComponent(receiverDog.name)}`, request.url));
}
