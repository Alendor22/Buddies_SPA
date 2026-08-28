import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createAuthToken, hashPassword, normalizeEmail } from '@/lib/auth';
import { clientIdentifier, rateLimit } from '@/lib/rateLimit';
import { absoluteAppUrl, sendTransactionalEmail } from '@/lib/email';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function registerAction(formData: FormData) {
  'use server';

  const displayName = String(formData.get('displayName') ?? '').trim();
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  const password = String(formData.get('password') ?? '');

  if (!displayName || !email || password.length < 8) redirect('/auth/register?error=invalid');

  // Unbounded registration let anyone create accounts in a loop and, worse, make us send
  // verification email to any address they chose -- a spam cannon pointed at our sending
  // reputation.
  const ip = clientIdentifier((await headers()).get('x-forwarded-for'));
  const [byIp, byEmail] = await Promise.all([
    rateLimit('register:ip', ip, 5, 60 * 60),
    rateLimit('register:email', email, 3, 60 * 60)
  ]);
  if (!byIp.allowed || !byEmail.allowed) redirect('/auth/register?error=throttled');

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, emailVerifiedAt: true } });
  if (existing?.emailVerifiedAt) redirect('/auth/login?error=exists');

  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: { displayName, passwordHash: hashPassword(password), emailVerifiedAt: null }, select: { id: true, email: true } })
    : await prisma.user.create({ data: { email, displayName, passwordHash: hashPassword(password), emailVerifiedAt: null }, select: { id: true, email: true } });

  const token = createAuthToken(user.id, user.email, 'verify-email');
  const verificationUrl = absoluteAppUrl(`/auth/verify-email?token=${encodeURIComponent(token)}`);

  try {
    await sendTransactionalEmail({
      to: user.email,
      subject: 'Verify your Buddies account',
      html: `<p>Confirm your email address to activate your Buddies account.</p><p><a href="${verificationUrl}">Verify email</a></p><p>This link expires in 24 hours.</p>`,
      text: `Confirm your Buddies account: ${verificationUrl}\n\nThis link expires in 24 hours.`
    });
  } catch {
    redirect('/auth/register?error=email');
  }

  redirect(`/auth/check-email?email=${encodeURIComponent(user.email)}`);
}

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const errorMessage = error === 'email'
    ? 'The account was created, but the verification email could not be sent. Try again after email delivery is configured.'
    : error === 'throttled'
      ? 'Too many sign-up attempts. Wait a while and try again.'
    : error
      ? 'Enter a valid name, email, and password of at least 8 characters.'
      : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div>
        <p className="text-sm font-medium text-slate-500">Buddies secure registration</p>
        <h1 className="mt-2 text-3xl font-bold">Create account</h1>
        <p className="mt-2 text-slate-600">A verification link will be sent to your email before the account can sign in.</p>
      </div>
      {errorMessage ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMessage}</div> : null}
      <form action={registerAction} className="mt-6 grid gap-4 rounded-2xl border bg-white p-6 shadow-sm">
        <label className="grid gap-2 text-sm font-medium">Display name<input name="displayName" autoComplete="name" maxLength={120} required className="rounded-lg border px-3 py-3 text-base" /></label>
        <label className="grid gap-2 text-sm font-medium">Email<input name="email" type="email" autoComplete="email" required className="rounded-lg border px-3 py-3 text-base" /></label>
        <label className="grid gap-2 text-sm font-medium">Password<input name="password" type="password" autoComplete="new-password" minLength={8} required className="rounded-lg border px-3 py-3 text-base" /></label>
        <button type="submit" className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Create account</button>
      </form>
      <p className="mt-6 text-sm text-slate-600">Already registered? <Link href="/auth/login" className="font-medium text-slate-900 underline">Sign in</Link></p>
    </main>
  );
}
