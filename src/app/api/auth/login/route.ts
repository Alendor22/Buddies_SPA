import { NextRequest, NextResponse } from 'next/server';
import { encodeSession, normalizeEmail, sessionCookieOptions, SESSION_COOKIE, verifyPassword } from '@/lib/auth';
import { prisma } from '@/lib/db';

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url), { status: 303 });
}

async function completeLogin(request: NextRequest, values: URLSearchParams | FormData) {
  const email = normalizeEmail(String(values.get('email') ?? ''));
  const password = String(values.get('password') ?? '');

  if (!email || !password) return redirectTo(request, '/auth/login?error=missing');

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true }
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return redirectTo(request, '/auth/login?error=invalid');
  }

  const response = redirectTo(request, '/dashboard');
  response.cookies.set(SESSION_COOKIE, encodeSession(user.id), sessionCookieOptions());
  return response;
}

export async function GET(request: NextRequest) {
  return completeLogin(request, request.nextUrl.searchParams);
}

export async function POST(request: NextRequest) {
  return completeLogin(request, await request.formData());
}
