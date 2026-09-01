import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { listBlockedUserIds } from '@/lib/social/repository';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const q = request.nextUrl.searchParams.get('q')?.trim().slice(0, 80) ?? '';
  const blocked = await listBlockedUserIds(user.id);
  const discoverableOwners = await prisma.$queryRaw<Array<{ userId: string }>>`
    SELECT "userId" FROM "SocialPrivacy" WHERE "discoverable" = true AND "userId" <> ${user.id}
  `;
  const ownerIds = discoverableOwners.map((row) => row.userId).filter((id) => !blocked.includes(id));
  if (!ownerIds.length) return NextResponse.json({ dogs: [] });

  const dogs = await prisma.dog.findMany({
    where: {
      ownerId: { in: ownerIds },
      status: 'SAFE',
      ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { breed: { contains: q, mode: 'insensitive' } }] } : {})
    },
    select: { id: true, name: true, slug: true, breed: true, photoUrl: true, temperament: true, friendlyDogs: true, ownerId: true },
    orderBy: { updatedAt: 'desc' },
    take: 50
  });

  return NextResponse.json({ dogs });
}
