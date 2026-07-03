import { BuddyRequestStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { orderedBuddyPair } from '@/lib/buddies';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/auth/login', request.url));

  const formData = await request.formData();
  const requestId = String(formData.get('requestId') ?? '');
  const action = String(formData.get('action') ?? '');

  const buddyRequest = await prisma.buddyRequest.findUnique({
    where: { id: requestId },
    select: { id: true, senderId: true, receiverId: true, status: true }
  });

  if (!buddyRequest) return NextResponse.redirect(new URL('/dashboard/buddies?error=request', request.url));

  if (action === 'cancel' && buddyRequest.senderId === user.id) {
    await prisma.buddyRequest.update({ where: { id: requestId }, data: { status: BuddyRequestStatus.CANCELLED, respondedAt: new Date() } });
    return NextResponse.redirect(new URL('/dashboard/buddies?cancelled=1', request.url));
  }

  if (buddyRequest.receiverId !== user.id) {
    return NextResponse.redirect(new URL('/dashboard/buddies?error=unauthorized', request.url));
  }

  if (action === 'decline') {
    await prisma.buddyRequest.update({ where: { id: requestId }, data: { status: BuddyRequestStatus.DECLINED, respondedAt: new Date() } });
    return NextResponse.redirect(new URL('/dashboard/buddies?declined=1', request.url));
  }

  if (action === 'accept') {
    const pair = orderedBuddyPair(buddyRequest.senderId, buddyRequest.receiverId);
    await prisma.$transaction([
      prisma.buddyRequest.update({ where: { id: requestId }, data: { status: BuddyRequestStatus.ACCEPTED, respondedAt: new Date() } }),
      prisma.buddy.upsert({ where: { userAId_userBId: pair }, create: pair, update: {} })
    ]);
    return NextResponse.redirect(new URL('/dashboard/buddies?accepted=1', request.url));
  }

  return NextResponse.redirect(new URL('/dashboard/buddies?error=action', request.url));
}
