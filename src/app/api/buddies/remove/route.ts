import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/auth/login', request.url));

  const formData = await request.formData();
  const buddyId = String(formData.get('buddyId') ?? '');

  const record = await prisma.buddy.findFirst({
    where: {
      id: buddyId,
      OR: [{ userAId: user.id }, { userBId: user.id }]
    },
    select: { id: true }
  });

  if (!record) return NextResponse.redirect(new URL('/dashboard/buddies?error=buddy', request.url));

  await prisma.buddy.delete({ where: { id: record.id } });
  return NextResponse.redirect(new URL('/dashboard/buddies?removed=1', request.url));
}
