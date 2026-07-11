import Link from 'next/link';
import { createSession, verifyAuthToken } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = '' } = await searchParams;
  const payload = verifyAuthToken(token, 'verify-email');

  if (!payload) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <p className="text-sm font-medium text-slate-500">Email verification</p>
        <h1 className="mt-2 text-3xl font-bold">Verification link expired</h1>
        <p className="mt-3 text-slate-600">Request a new verification email and use the newest link.</p>
        <Link href="/auth/check-email" className="mt-6 rounded-lg bg-slate-900 px-5 py-3 text-center font-medium text-white">Request another link</Link>
      </main>
    );
  }

  const user = await prisma.user.findFirst({ where: { id: payload.userId, email: payload.email }, select: { id: true } });
  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <h1 className="text-3xl font-bold">Account unavailable</h1>
        <p className="mt-3 text-slate-600">The account associated with this verification link could not be found.</p>
        <Link href="/auth/register" className="mt-6 rounded-lg bg-slate-900 px-5 py-3 text-center font-medium text-white">Create account</Link>
      </main>
    );
  }

  await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  await createSession(user.id);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <p className="text-sm font-medium text-emerald-700">Email verified</p>
      <h1 className="mt-2 text-3xl font-bold">Your Buddies account is active</h1>
      <p className="mt-3 text-slate-600">Your email address has been confirmed and you are signed in.</p>
      <Link href="/dashboard" className="mt-6 rounded-lg bg-slate-900 px-5 py-3 text-center font-medium text-white">Open dashboard</Link>
    </main>
  );
}
