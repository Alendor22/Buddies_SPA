import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createConversation, listBlockedUserIds, listConversations } from '@/lib/social/repository';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  return NextResponse.json({ conversations: await listConversations(user.id) });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const payload = await request.json().catch(() => null) as { memberId?: unknown } | null;
  const memberId = typeof payload?.memberId === 'string' ? payload.memberId.trim() : '';
  if (!memberId || memberId === user.id) return NextResponse.json({ error: 'A valid member is required.' }, { status: 400 });

  const blocked = await listBlockedUserIds(user.id);
  if (blocked.includes(memberId)) return NextResponse.json({ error: 'Conversation is not available.' }, { status: 403 });

  const target = await prisma.user.findUnique({ where: { id: memberId }, select: { id: true } });
  if (!target) return NextResponse.json({ error: 'Member not found.' }, { status: 404 });
  const privacy = await prisma.$queryRaw<Array<{ allowMessages: boolean }>>`
    SELECT "allowMessages" FROM "SocialPrivacy" WHERE "userId" = ${memberId} LIMIT 1
  `;
  if (privacy[0] && !privacy[0].allowMessages) return NextResponse.json({ error: 'This member is not accepting messages.' }, { status: 403 });

  const conversationId = await createConversation(user.id, memberId);
  return NextResponse.json({ conversationId }, { status: 201 });
}
