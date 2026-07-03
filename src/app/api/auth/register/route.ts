import { NextRequest, NextResponse } from 'next/server';
import { createSession, hashPassword, normalizeEmail } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  const displayName = String(formData.get('displayName') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !displayName || password.length < 8) {
    return NextResponse.redirect(new URL('/auth/register?error=invalid', request.url));
  }

  try {
    const user = await prisma.user.create({
      data: {
        email,
        displayName,
        passwordHash: hashPassword(password),
        emailVerifiedAt: new Date()
      },
      select: { id: true }
    });

    await createSession(user.id);
    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch {
    return NextResponse.redirect(new URL('/auth/register?error=exists', request.url));
  }
}
