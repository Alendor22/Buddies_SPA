import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, normalizeEmail } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { orderedBuddyPair } from '@/lib/buddies';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/auth/login', request.url));

  const formData = await request.formData();
  const dogId = String(formData.get('dogId') ?? '');
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  const startsAtRaw = String(formData.get('startsAt') ?? '');
  const note = String(formData.get('note') ?? '').trim() || null;

  if (!dogId || !email || !startsAtRaw) return NextResponse.redirect(new URL('/dashboard/buddies?error=walk-invalid', request.url));

  const [dog, receiver] = await Promise.all([
    prisma.dog.findFirst({ where: { id: dogId, ownerId: user.id }, select: { id: true } }),
    prisma.user.findUnique({ where: { email }, select: { id: true } })
  ]);

  if (!dog || !receiver || receiver.id === user.id) return NextResponse.redirect(new URL('/dashboard/buddies?error=walk-invalid', request.url));

  const pair = orderedBuddyPair(user.id, receiver.id);
  const buddy = await prisma.buddy.findUnique({ where: { userAId_userBId: pair }, select: { id: true } });
  if (!buddy) return NextResponse.redirect(new URL('/dashboard/buddies?error=exists', request.url));

  await prisma.walk.create({
    data: {
      dogId,
      requesterId: user.id,
      walkerId: receiver.id,
      startsAt: new Date(startsAtRaw),
      durationMin: 30,
      notes: note
    }
  });

  return NextResponse.redirect(new URL('/dashboard/buddies?walk=sent', request.url));
}
