import { NextRequest, NextResponse } from 'next/server';
import { createSession, hashPassword, normalizeEmail } from '@/lib/auth';
import { prisma } from '@/lib/db';

function valueFrom(params: URLSearchParams | FormData, key: string) {
  return String(params.get(key) ?? '').trim();
}

async function completeRegister(request: NextRequest, values: URLSearchParams | FormData) {
  const email = normalizeEmail(valueFrom(values, 'email')) || `demo-${Date.now()}@buddies.local`;
  const displayName = valueFrom(values, 'displayName') || 'Buddies User';
  const password = String(values.get('password') ?? '') || 'buddies-demo-password';

  try {
    const user = await prisma.user.upsert({
      where: { email },
      update: { displayName },
      create: {
        email,
        displayName,
        passwordHash: hashPassword(password),
        emailVerifiedAt: new Date()
      },
      select: { id: true }
    });

    await createSession(user.id);
    return NextResponse.redirect(new URL('/dashboard', request.url), { status: 303 });
  } catch {
    return NextResponse.redirect(new URL('/auth/register?error=exists', request.url), { status: 303 });
  }
}

export async function GET(request: NextRequest) {
  return completeRegister(request, request.nextUrl.searchParams);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  return completeRegister(request, formData);
}
