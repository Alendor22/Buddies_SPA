import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isConversationMember, listMessages, sendMessage } from '@/lib/social/repository';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const { id } = await context.params;
  if (!(await isConversationMember(id, user.id))) return NextResponse.json({ error: 'Thread not found.' }, { status: 404 });
  return NextResponse.json({ messages: await listMessages(id) });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const { id } = await context.params;
  if (!(await isConversationMember(id, user.id))) return NextResponse.json({ error: 'Thread not found.' }, { status: 404 });
  const payload = await request.json().catch(() => null) as { body?: unknown } | null;
  const body = typeof payload?.body === 'string' ? payload.body.trim().slice(0, 2000) : '';
  if (!body) return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
  const messageId = await sendMessage(id, user.id, body);
  return NextResponse.json({ messageId }, { status: 201 });
}
