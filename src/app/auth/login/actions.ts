'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSession, normalizeEmail, verifyPassword } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { clientIdentifier, rateLimit } from '@/lib/rateLimit';

// pbkdf2 at 120k iterations makes every attempt expensive for us as well as for an
// attacker, so unbounded guessing is both a credential-stuffing risk and a compute bill.
const MAX_ATTEMPTS_PER_IP = 10;
const MAX_ATTEMPTS_PER_EMAIL = 5;
const WINDOW_SECONDS = 15 * 60;

export async function loginAction(formData: FormData) {
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  const password = String(formData.get('password') ?? '');

  if (!email || !password) redirect('/auth/login?error=missing');

  const headerList = await headers();
  const ip = clientIdentifier(headerList.get('x-forwarded-for'));

  const [byIp, byEmail] = await Promise.all([
    rateLimit('login:ip', ip, MAX_ATTEMPTS_PER_IP, WINDOW_SECONDS),
    rateLimit('login:email', email, MAX_ATTEMPTS_PER_EMAIL, WINDOW_SECONDS)
  ]);

  // Throttle before touching the database or running the password hash.
  if (!byIp.allowed || !byEmail.allowed) redirect('/auth/login?error=throttled');

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, emailVerifiedAt: true }
  });

  if (!user || !verifyPassword(password, user.passwordHash)) redirect('/auth/login?error=invalid');
  if (!user.emailVerifiedAt) redirect(`/auth/check-email?email=${encodeURIComponent(email)}&unverified=1`);

  await createSession(user.id);
  redirect('/dashboard');
}
