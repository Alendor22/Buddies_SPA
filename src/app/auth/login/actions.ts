'use server';

import { redirect } from 'next/navigation';
import { createSession, normalizeEmail, verifyPassword } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function loginAction(formData: FormData) {
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    redirect('/auth/login?error=missing');
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true }
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    redirect('/auth/login?error=invalid');
  }

  await createSession(user.id);
  redirect('/dashboard');
}
