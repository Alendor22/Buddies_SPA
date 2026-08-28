import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createAuthToken, normalizeEmail } from '@/lib/auth';
import { clientIdentifier, rateLimit } from '@/lib/rateLimit';
import { absoluteAppUrl, sendTransactionalEmail } from '@/lib/email';
import { prisma } from '@/lib/db';

async function forgotPasswordAction(formData: FormData) {
  'use server';
  const email = normalizeEmail(String(formData.get('email') ?? ''));

  // Without a limit, this endpoint will send an unlimited number of password-reset
  // emails to any address that has an account. The response is deliberately identical
  // whether or not we throttled, to preserve the existing non-enumerable behaviour.
  const ip = clientIdentifier((await headers()).get('x-forwarded-for'));
  const [byIp, byEmail] = await Promise.all([
    rateLimit('forgot:ip', ip, 5, 60 * 60),
    rateLimit('forgot:email', email || 'empty', 3, 60 * 60)
  ]);
  const throttled = !byIp.allowed || !byEmail.allowed;

  if (email && !throttled) {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, emailVerifiedAt: true } });
    if (user?.emailVerifiedAt) {
      const token = createAuthToken(user.id, user.email, 'reset-password');
      const resetUrl = absoluteAppUrl(`/auth/reset-password?token=${encodeURIComponent(token)}`);
      await sendTransactionalEmail({
        to: user.email,
        subject: 'Reset your Buddies password',
        html: `<p>A password reset was requested for your Buddies account.</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires in 30 minutes. Ignore this message if you did not request it.</p>`,
        text: `Reset your Buddies password: ${resetUrl}\n\nThis link expires in 30 minutes. Ignore this message if you did not request it.`
      }).catch(() => null);
    }
  }

  redirect('/auth/forgot-password?sent=1');
}

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { sent } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <p className="text-sm font-medium text-slate-500">Account recovery</p>
      <h1 className="mt-2 text-3xl font-bold">Forgot password</h1>
      <p className="mt-3 text-slate-600">Enter your verified email address. If the account exists, a time-limited reset link will be sent.</p>
      {sent ? <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Check your inbox and spam folder. For security, this message is shown whether or not an account exists.</p> : null}
      <form action={forgotPasswordAction} className="mt-6 grid gap-4 rounded-2xl border bg-white p-6 shadow-sm">
        <label className="grid gap-2 text-sm font-medium">Email<input name="email" type="email" autoComplete="email" required className="rounded-lg border px-3 py-3 text-base" /></label>
        <button type="submit" className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Send reset link</button>
      </form>
      <Link href="/auth/login" className="mt-6 text-sm font-medium text-slate-900 underline">Return to sign in</Link>
    </main>
  );
}
