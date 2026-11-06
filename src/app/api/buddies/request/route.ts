import { BuddyRequestStatus, NotificationType } from '@/generated/prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, normalizeEmail } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { orderedDogBuddyPair } from '@/lib/buddies';
import { UI_ROUTES } from '@/lib/uiRoutes';

export const dynamic = 'force-dynamic';

const SIDE_EFFECT_TIMEOUT_MS = 2500;

type RequestResult = {
  ok: boolean;
  error?: string;
  code?: string;
  request?: {
    id: string;
    status: BuddyRequestStatus;
    senderDogId: string;
    senderDogName: string;
    receiverDogId: string;
    receiverDogName: string;
  };
};

function wantsJson(request: NextRequest) {
  return request.headers.get('x-buddies-response') === 'json'
    || request.headers.get('accept')?.includes('application/json');
}

function jsonOrRedirect(request: NextRequest, result: RequestResult, redirectPath: string, status = 200) {
  if (wantsJson(request)) {
    return NextResponse.json(result, { status });
  }
  return NextResponse.redirect(new URL(redirectPath, request.url));
}

async function runBestEffort(task: Promise<unknown>) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      task,
      new Promise<void>((resolve) => {
        timeout = setTimeout(resolve, SIDE_EFFECT_TIMEOUT_MS);
      })
    ]);
  } catch (error) {
    console.error('Buddy request notification side effect failed.', error);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return jsonOrRedirect(request, { ok: false, error: 'Authentication required.', code: 'AUTH' }, '/auth/login', 401);
  }

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
    return jsonOrRedirect(
      request,
      { ok: false, error: 'Choose a valid dog-to-dog request pair.', code: 'INVALID' },
      `${UI_ROUTES.buddies}?error=invalid`,
      400
    );
  }

  const pair = orderedDogBuddyPair(senderDog.id, receiverDog.id);
  const existingBuddy = await prisma.dogBuddy.findUnique({
    where: { dogAId_dogBId: pair },
    select: { id: true }
  });
  if (existingBuddy) {
    return jsonOrRedirect(
      request,
      { ok: false, error: `${senderDog.name} and ${receiverDog.name} are already buddies.`, code: 'EXISTS' },
      `${UI_ROUTES.buddies}?error=exists`,
      409
    );
  }

  const reverse = await prisma.dogBuddyRequest.findUnique({
    where: {
      senderDogId_receiverDogId: {
        senderDogId: receiverDog.id,
        receiverDogId: senderDog.id
      }
    },
    select: { id: true, status: true }
  });

  if (reverse?.status === BuddyRequestStatus.PENDING) {
    return jsonOrRedirect(
      request,
      { ok: false, error: `${receiverDog.name} already sent ${senderDog.name} a request. Review it first.`, code: 'RESPOND_FIRST' },
      `${UI_ROUTES.buddies}?error=respond-first`,
      409
    );
  }

  const existing = await prisma.dogBuddyRequest.findUnique({
    where: {
      senderDogId_receiverDogId: {
        senderDogId: senderDog.id,
        receiverDogId: receiverDog.id
      }
    },
    select: { id: true, status: true }
  });

  if (existing?.status === BuddyRequestStatus.PENDING) {
    return jsonOrRedirect(
      request,
      {
        ok: true,
        request: {
          id: existing.id,
          status: existing.status,
          senderDogId: senderDog.id,
          senderDogName: senderDog.name,
          receiverDogId: receiverDog.id,
          receiverDogName: receiverDog.name
        }
      },
      `${UI_ROUTES.buddies}?sent=1&from=${encodeURIComponent(senderDog.name)}&to=${encodeURIComponent(receiverDog.name)}`
    );
  }

  // Persist the primary action first. Notification maintenance is secondary and
  // must not keep the request button waiting indefinitely on a serverless call.
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

  await runBestEffort(prisma.$transaction([
    prisma.notification.updateMany({
      where: {
        userId: receiverDog.ownerId,
        dogBuddyRequestId: buddyRequest.id,
        readAt: null
      },
      data: { readAt: new Date() }
    }),
    prisma.notification.create({
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
    })
  ]));

  return jsonOrRedirect(
    request,
    {
      ok: true,
      request: {
        id: buddyRequest.id,
        status: buddyRequest.status,
        senderDogId: senderDog.id,
        senderDogName: senderDog.name,
        receiverDogId: receiverDog.id,
        receiverDogName: receiverDog.name
      }
    },
    `${UI_ROUTES.buddies}?sent=1&from=${encodeURIComponent(senderDog.name)}&to=${encodeURIComponent(receiverDog.name)}`,
    201
  );
}
