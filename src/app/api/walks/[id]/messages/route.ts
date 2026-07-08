import { NotificationType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { realtimeChannels } from '@/lib/realtimeChannels';
import { publishRealtime } from '@/lib/realtimeServer';
import { getWalkAccess } from '@/lib/walkAccess';

export const dynamic = 'force-dynamic';

const SIDE_EFFECT_TIMEOUT_MS = 2500;

function messageDto(message: { id: string; senderId: string; body: string; createdAt: Date }, senderLabel: string) {
  return {
    id: message.id,
    senderId: message.senderId,
    senderLabel,
    body: message.body,
    createdAt: message.createdAt.toISOString()
  };
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
    console.error('Walk message side effect failed.', error);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const { id: walkId } = await context.params;
  const access = await getWalkAccess(walkId, user.id);
  if (!access) return NextResponse.json({ error: 'Walk thread not found.' }, { status: 404 });

  const afterValue = request.nextUrl.searchParams.get('after');
  const after = afterValue ? new Date(afterValue) : null;
  const hasValidAfter = Boolean(after && !Number.isNaN(after.getTime()));

  const messages = hasValidAfter
    ? await prisma.message.findMany({
        where: { walkId, createdAt: { gt: after as Date } },
        orderBy: { createdAt: 'asc' },
        take: 100
      })
    : (await prisma.message.findMany({
        where: { walkId },
        orderBy: { createdAt: 'desc' },
        take: 100
      })).reverse();

  return NextResponse.json({
    messages: messages.map((message) => messageDto(message, access.labels.get(message.senderId) ?? 'Walk participant'))
  });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const { id: walkId } = await context.params;
  const access = await getWalkAccess(walkId, user.id);
  if (!access) return NextResponse.json({ error: 'Walk thread not found.' }, { status: 404 });

  const payload = await request.json().catch(() => null) as { body?: unknown } | null;
  const body = typeof payload?.body === 'string' ? payload.body.trim() : '';
  if (!body || body.length > 2000) {
    return NextResponse.json({ error: 'Message must contain between 1 and 2,000 characters.' }, { status: 400 });
  }

  const senderLabel = access.labels.get(user.id) ?? 'Walk participant';
  const recipients = access.participantIds.filter((participantId) => participantId !== user.id);

  // Persist the user-visible action first. Notifications and realtime delivery are
  // secondary effects and must never hold the HTTP response open indefinitely.
  const message = await prisma.message.create({
    data: { walkId, senderId: user.id, body }
  });
  const dto = messageDto(message, senderLabel);

  const notificationTask = recipients.length
    ? prisma.notification.createMany({
        data: recipients.map((recipientId) => ({
          userId: recipientId,
          type: NotificationType.MESSAGE,
          routeKey: 'messages',
          href: `/dashboard/walks/${walkId}/messages`,
          title: `${senderLabel} sent a walk message`,
          body: body.length > 160 ? `${body.slice(0, 157)}…` : body,
          dogId: access.walk.dog.id,
          walkId,
          messageId: message.id
        }))
      })
    : Promise.resolve();

  await Promise.all([
    runBestEffort(notificationTask),
    runBestEffort(publishRealtime(realtimeChannels.messages(walkId), 'message.created', dto))
  ]);

  return NextResponse.json({ message: dto }, { status: 201 });
}
