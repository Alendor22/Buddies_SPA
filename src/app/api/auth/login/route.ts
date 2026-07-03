import { NextRequest, NextResponse } from 'next/server';
import { createSession, normalizeEmail, verifyPassword } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  const password = String(formData.get('password') ?? '');

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true }
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.redirect(new URL('/auth/login?error=invalid', request.url));
  }

  await createSession(user.id);
  return NextResponse.redirect(new URL('/dashboard', request.url));
}
