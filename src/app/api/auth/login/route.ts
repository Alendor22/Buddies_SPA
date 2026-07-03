import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { normalizeEmail, verifyPassword } from '@/lib/auth';
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

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  const password = String(formData.get('password') ?? '');

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true }
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.redirect(new URL('/auth/login?error=invalid', request.url), { status: 303 });
  }

  const response = NextResponse.redirect(new URL('/dashboard', request.url), { status: 303 });
  response.cookies.set(SESSION_COOKIE, encodeSession(user.id), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/'
  });
  return response;
}
