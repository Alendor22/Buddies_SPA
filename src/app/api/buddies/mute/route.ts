import { BuddyRequestStatus } from '@/generated/prisma/client';
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
  if (!email || email === user.email) return NextResponse.redirect(new URL('/dashboard/buddies?error=invalid', request.url));
  const target = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!target) return NextResponse.redirect(new URL('/dashboard/buddies?error=not-found', request.url));
  const pair = orderedBuddyPair(user.id, target.id);
  await prisma.$transaction([
    prisma.buddy.deleteMany({ where: { userAId: pair.userAId, userBId: pair.userBId } }),
    prisma.buddyRequest.updateMany({ where: { OR: [{ senderId: user.id, receiverId: target.id }, { senderId: target.id, receiverId: user.id }] }, data: { status: BuddyRequestStatus.CANCELLED, respondedAt: new Date() } })
  ]);
  return NextResponse.redirect(new URL('/dashboard/buddies?blocked=1', request.url));
}
