import { NextRequest, NextResponse } from 'next/server';
import { NotificationType } from '@/generated/prisma/client';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createNotification } from '@/lib/notifications';
import { getConversationPeers, isConversationMember, listBlockedUserIds, listMessages, sendMessage } from '@/lib/social/repository';
import { publishRealtime } from '@/lib/realtimeServer';
import { realtimeChannels } from '@/lib/realtimeChannels';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const { id } = await context.params;
  if (!(await isConversationMember(id, user.id))) return NextResponse.json({ error: 'Thread not found.' }, { status: 404 });
  const peers = await getConversationPeers(id, user.id);
  if (peers.length !== 1) return NextResponse.json({ error: 'Direct conversation not found.' }, { status: 404 });
  const peerDogs = await prisma.dog.findMany({ where: { ownerId: peers[0].userId }, select: { id: true, name: true, ownerId: true, breed: true, photoUrl: true }, orderBy: { name: 'asc' } });
  return NextResponse.json({ messages: await listMessages(id), peerDogs });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const { id } = await context.params;
  if (!(await isConversationMember(id, user.id))) return NextResponse.json({ error: 'Thread not found.' }, { status: 404 });

  const payload = await request.json().catch(() => null) as { body?: unknown; senderDogId?: unknown; recipientDogId?: unknown } | null;
  const body = typeof payload?.body === 'string' ? payload.body.trim().slice(0, 2000) : '';
  const senderDogId = typeof payload?.senderDogId === 'string' ? payload.senderDogId.trim() : '';
  const recipientDogId = typeof payload?.recipientDogId === 'string' ? payload.recipientDogId.trim() : '';
  if (!body) return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
  if (!senderDogId) return NextResponse.json({ error: 'Select a dog profile before sending.' }, { status: 400 });
  if (!recipientDogId) return NextResponse.json({ error: 'Select the dog to receive this message.' }, { status: 400 });

  const [blocked, peers] = await Promise.all([listBlockedUserIds(user.id), getConversationPeers(id, user.id)]);
  if (peers.length !== 1) return NextResponse.json({ error: 'Direct conversation not found.' }, { status: 404 });
  if (peers.some((peer) => blocked.includes(peer.userId))) return NextResponse.json({ error: 'Conversation is not available.' }, { status: 403 });
  if (peers.some((peer) => !peer.allowMessages)) return NextResponse.json({ error: 'This member is not accepting messages.' }, { status: 403 });

  const senderDog = await prisma.dog.findFirst({ where: { id: senderDogId, ownerId: user.id }, select: { id: true, name: true, slug: true, photoUrl: true } });
  if (!senderDog) return NextResponse.json({ error: 'Sender dog is not owned by this account.' }, { status: 403 });

  const recipientDog = await prisma.dog.findFirst({ where: { id: recipientDogId, ownerId: peers[0]?.userId }, select: { id: true, name: true } });
  if (!recipientDog) return NextResponse.json({ error: 'Recipient dog does not belong to the other conversation member.' }, { status: 403 });

  const messageId = await sendMessage(id, user.id, body, senderDog.id, recipientDog.id);
  const notification = await createNotification({
    userId: peers[0].userId,
    type: NotificationType.MESSAGE,
    routeKey: 'messages',
    href: `/dashboard/messages?conversation=${encodeURIComponent(id)}`,
    title: `New message from ${senderDog.name}`,
    body: body.slice(0, 240)
  });
  await Promise.all([
    publishRealtime(realtimeChannels.conversation(id), 'message.created', { messageId, conversationId: id }),
    publishRealtime(realtimeChannels.userNotifications(peers[0].userId), 'notification.created', {
      notificationId: notification.id,
      conversationId: id,
      href: notification.href,
      title: notification.title,
      body: notification.body
    })
  ]);
  return NextResponse.json({ messageId, senderDog, recipientDog }, { status: 201 });
}
