import Link from 'next/link';
import { hashPassword, normalizeEmail } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

type RegisterParams = {
  displayName?: string;
  email?: string;
  password?: string;
};

export default async function RegisterConfirmPage({ searchParams }: { searchParams: Promise<RegisterParams> }) {
  const values = await searchParams;
  const displayName = String(values.displayName ?? '').trim() || 'Buddies User';
  const email = normalizeEmail(String(values.email ?? '').trim()) || `demo-${Date.now()}@buddies.local`;
  const password = String(values.password ?? '') || 'buddies-demo-password';

  let created = false;
  let message = '';

  try {
    await prisma.user.upsert({
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
    created = true;
    message = `Account ready for ${displayName}. Mobile cookie login is still bypassed; continue to the dashboard.`;
  } catch {
    message = 'The account could not be created. Go back and try another email.';
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <p className="text-sm font-medium text-slate-500">Buddies V2.2 Register Page Route Fix</p>
      <h1 className="mt-2 text-3xl font-bold">{created ? 'Account created' : 'Create account failed'}</h1>
      <p className="mt-3 text-slate-600">{message}</p>
      {created ? (
        <Link href="/dashboard" className="mt-6 rounded-lg bg-slate-900 px-5 py-3 text-center font-medium text-white">Continue to dashboard</Link>
      ) : (
        <Link href="/auth/register" className="mt-6 rounded-lg bg-slate-900 px-5 py-3 text-center font-medium text-white">Back to create account</Link>
      )}
      <Link href="/auth/login" className="mt-3 rounded-lg border px-5 py-3 text-center font-medium">Back to sign in</Link>
    </main>
  );
}
