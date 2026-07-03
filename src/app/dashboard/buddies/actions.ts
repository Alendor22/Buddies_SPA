'use server';

import { FriendshipStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { DEMO_USER_ID } from '@/lib/demo-user';

export async function acceptBuddyRequest(formData: FormData) {
  const friendshipId = String(formData.get('friendshipId') ?? '');
  if (!friendshipId) return;

  await prisma.friendship.update({
    where: { id: friendshipId },
    data: { status: FriendshipStatus.ACCEPTED }
  });

  revalidatePath('/dashboard/buddies');
}

export async function declineBuddyRequest(formData: FormData) {
  const friendshipId = String(formData.get('friendshipId') ?? '');
  if (!friendshipId) return;

  await prisma.friendship.update({
    where: { id: friendshipId },
    data: { status: FriendshipStatus.DECLINED }
  });

  revalidatePath('/dashboard/buddies');
}

export async function sendBuddyRequest(formData: FormData) {
  const addresseeId = String(formData.get('addresseeId') ?? '');
  if (!addresseeId || addresseeId === DEMO_USER_ID) return;

  await prisma.friendship.upsert({
    where: {
      requesterId_addresseeId: {
        requesterId: DEMO_USER_ID,
        addresseeId
      }
    },
    update: { status: FriendshipStatus.PENDING },
    create: {
      requesterId: DEMO_USER_ID,
      addresseeId,
      status: FriendshipStatus.PENDING,
      note: 'Demo buddy request.'
    }
  });

  revalidatePath('/dashboard/buddies');
}
