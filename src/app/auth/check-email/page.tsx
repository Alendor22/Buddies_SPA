import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createAuthToken, normalizeEmail } from '@/lib/auth';
import { absoluteAppUrl, sendTransactionalEmail } from '@/lib/email';
import { prisma } from '@/lib/db';

async function resendVerification(formData: FormData) {
  'use server';
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  if (!email) redirect('/auth/check-email?resent=1');

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, emailVerifiedAt: true } });
  if (user && !user.emailVerifiedAt) {
    const token = createAuthToken(user.id, user.email, 'verify-email');
    const url = absoluteAppUrl(`/auth/verify-email?token=${encodeURIComponent(token)}`);
    await sendTransactionalEmail({
      to: user.email,
      subject: 'Verify your Buddies account',
      html: `<p>Confirm your email address to activate your Buddies account.</p><p><a href="${url}">Verify email</a></p><p>This link expires in 24 hours.</p>`,
      text: `Confirm your Buddies account: ${url}\n\nThis link expires in 24 hours.`
    }).catch(() => null);
  }

  redirect(`/auth/check-email?email=${encodeURIComponent(email)}&resent=1`);
}

export default async function CheckEmailPage({ searchParams }: { searchParams: Promise<{ email?: string; resent?: string; unverified?: string }> }) {
  const { email = '', resent, unverified } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <p className="text-sm font-medium text-slate-500">Email verification</p>
      <h1 className="mt-2 text-3xl font-bold">Check your email</h1>
      <p className="mt-3 text-slate-600">{unverified ? 'This account must be verified before signing in.' : 'Your account was created but is not active yet.'}</p>
      <p className="mt-2 break-all text-sm text-slate-500">Verification destination: {email || 'your registered email address'}</p>
      {resent ? <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">A new verification message was requested. Check your inbox and spam folder.</p> : null}
      <form action={resendVerification} className="mt-6 grid gap-3 rounded-2xl border bg-white p-6 shadow-sm">
        <input type="hidden" name="email" value={email} />
        <button type="submit" className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Resend verification email</button>
        <Link href="/auth/login" className="rounded-lg border px-5 py-3 text-center font-medium">Return to sign in</Link>
      </form>
    </main>
  );
}
