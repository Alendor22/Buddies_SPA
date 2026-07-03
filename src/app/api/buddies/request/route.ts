import { BuddyRequestStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, normalizeEmail } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { orderedBuddyPair } from '@/lib/buddies';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/auth/login', request.url));

  const formData = await request.formData();
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  const note = String(formData.get('note') ?? '').trim() || null;

  if (!email || email === user.email) {
    return NextResponse.redirect(new URL('/dashboard/buddies?error=invalid', request.url));
  }

  const receiver = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!receiver) return NextResponse.redirect(new URL('/dashboard/buddies?error=not-found', request.url));

  const pair = orderedBuddyPair(user.id, receiver.id);
  const existingBuddy = await prisma.buddy.findUnique({ where: { userAId_userBId: pair }, select: { id: true } });
  if (existingBuddy) return NextResponse.redirect(new URL('/dashboard/buddies?error=exists', request.url));

  const reverse = await prisma.buddyRequest.findUnique({
    where: { senderId_receiverId: { senderId: receiver.id, receiverId: user.id } },
    select: { status: true }
  });

  if (reverse?.status === BuddyRequestStatus.PENDING) {
    return NextResponse.redirect(new URL('/dashboard/buddies?error=respond-first', request.url));
  }

  await prisma.buddyRequest.upsert({
    where: { senderId_receiverId: { senderId: user.id, receiverId: receiver.id } },
    create: { senderId: user.id, receiverId: receiver.id, message: note },
    update: { status: BuddyRequestStatus.PENDING, message: note, respondedAt: null }
  });

  return NextResponse.redirect(new URL('/dashboard/buddies?sent=1', request.url));
}
