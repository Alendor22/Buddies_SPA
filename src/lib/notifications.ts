import { NotificationType } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';

export type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  routeKey: string;
  href: string;
  title: string;
  body?: string | null;
  dogId?: string | null;
  walkId?: string | null;
  walkInvitationId?: string | null;
  buddyRequestId?: string | null;
  sightingId?: string | null;
};

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      routeKey: input.routeKey,
      href: input.href,
      title: input.title,
      body: input.body ?? null,
      dogId: input.dogId ?? null,
      walkId: input.walkId ?? null,
      walkInvitationId: input.walkInvitationId ?? null,
      buddyRequestId: input.buddyRequestId ?? null,
      sightingId: input.sightingId ?? null
    }
  });
}

export async function markNotificationRead(notificationId: string, userId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() }
  });
}

export async function markRouteNotificationsRead(routeKey: string, userId: string) {
  return prisma.notification.updateMany({
    where: { routeKey, userId, readAt: null },
    data: { readAt: new Date() }
  });
}
