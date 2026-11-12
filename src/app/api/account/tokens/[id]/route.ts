import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { revokePersonalAccessToken } from '@/lib/apiTokens';
import { rateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const limit = await rateLimit('account:tokens:revoke', user.id, 30, 3600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  const { id } = await context.params;
  const revoked = await revokePersonalAccessToken(user.id, id);
  if (!revoked) return NextResponse.json({ error: 'Token not found.' }, { status: 404 });
  return NextResponse.json({ revoked: true });
}
