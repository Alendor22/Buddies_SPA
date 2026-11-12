import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { ApiTokenLimitError, createPersonalAccessToken, listPersonalAccessTokens } from '@/lib/apiTokens';
import { rateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

const createSchema = z.object({ name: z.string().trim().min(1).max(80) });

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  return NextResponse.json({ tokens: await listPersonalAccessTokens(user.id) });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const limit = await rateLimit('account:tokens:create', user.id, 10, 3600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many tokens created recently. Try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'A token name is required.' }, { status: 400 });

  try {
    const created = await createPersonalAccessToken(user.id, parsed.data.name);
    return NextResponse.json({ token: created }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiTokenLimitError) return NextResponse.json({ error: error.message }, { status: 409 });
    throw error;
  }
}
