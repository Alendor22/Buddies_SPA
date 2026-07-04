import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/db';

const SESSION_COOKIE = 'buddies_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function signSession(userId: string) {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? 'dev-only-buddies-secret';
  return createHash('sha256').update(`${userId}.${secret}`).digest('hex');
}

function encodeSession(userId: string) {
  return Buffer.from(JSON.stringify({ userId, signature: signSession(userId) })).toString('base64url');
}

export async function GET(request: NextRequest) {
  const user = await prisma.user.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true }
  });

  if (!user) {
    return NextResponse.redirect(new URL('/auth/register', request.url), { status: 303 });
  }

  const response = NextResponse.redirect(new URL('/dashboard', request.url), { status: 303 });
  response.cookies.set(SESSION_COOKIE, encodeSession(user.id), {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/'
  });

  return response;
}
