import { NextRequest, NextResponse } from 'next/server';
import { encodeSession, hashPassword, normalizeEmail, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth';
import { prisma } from '@/lib/db';

function valueFrom(params: URLSearchParams | FormData, key: string) {
  return String(params.get(key) ?? '').trim();
}

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url), { status: 303 });
}

async function completeRegister(request: NextRequest, values: URLSearchParams | FormData) {
  const email = normalizeEmail(valueFrom(values, 'email'));
  const displayName = valueFrom(values, 'displayName');
  const password = String(values.get('password') ?? '');

  if (!email || !displayName || password.length < 8) {
    return redirectTo(request, '/auth/register?error=invalid');
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return redirectTo(request, '/auth/register?error=exists');

  const user = await prisma.user.create({
    data: {
      email,
      displayName,
      passwordHash: hashPassword(password),
      emailVerifiedAt: new Date()
    },
    select: { id: true }
  });

  const response = redirectTo(request, '/dashboard');
  response.cookies.set(SESSION_COOKIE, encodeSession(user.id), sessionCookieOptions());
  return response;
}

export async function GET(request: NextRequest) {
  return completeRegister(request, request.nextUrl.searchParams);
}

export async function POST(request: NextRequest) {
  return completeRegister(request, await request.formData());
}
