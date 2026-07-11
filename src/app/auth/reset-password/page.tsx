import Link from 'next/link';
import { redirect } from 'next/navigation';
import { hashPassword, verifyAuthToken } from '@/lib/auth';
import { prisma } from '@/lib/db';

async function resetPasswordAction(formData: FormData) {
  'use server';
  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  const confirmPassword = String(formData.get('confirmPassword') ?? '');
  const payload = verifyAuthToken(token, 'reset-password');

  if (!payload || password.length < 8 || password !== confirmPassword) {
    redirect(`/auth/reset-password?token=${encodeURIComponent(token)}&error=invalid`);
  }

  const user = await prisma.user.findFirst({ where: { id: payload.userId, email: payload.email }, select: { id: true } });
  if (!user) redirect('/auth/reset-password?error=expired');

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(password) } });
  redirect('/auth/login?reset=1');
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token = '', error } = await searchParams;
  const payload = verifyAuthToken(token, 'reset-password');

  if (!payload) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <p className="text-sm font-medium text-slate-500">Account recovery</p>
        <h1 className="mt-2 text-3xl font-bold">Reset link expired</h1>
        <p className="mt-3 text-slate-600">Request a new password-reset email. Reset links expire after 30 minutes.</p>
        <Link href="/auth/forgot-password" className="mt-6 rounded-lg bg-slate-900 px-5 py-3 text-center font-medium text-white">Request new link</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <p className="text-sm font-medium text-slate-500">Account recovery</p>
      <h1 className="mt-2 text-3xl font-bold">Set a new password</h1>
      <p className="mt-3 text-slate-600">Use at least 8 characters. Both password fields must match.</p>
      {error ? <p className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">The passwords were invalid or did not match.</p> : null}
      <form action={resetPasswordAction} className="mt-6 grid gap-4 rounded-2xl border bg-white p-6 shadow-sm">
        <input type="hidden" name="token" value={token} />
        <label className="grid gap-2 text-sm font-medium">New password<input name="password" type="password" autoComplete="new-password" minLength={8} required className="rounded-lg border px-3 py-3 text-base" /></label>
        <label className="grid gap-2 text-sm font-medium">Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required className="rounded-lg border px-3 py-3 text-base" /></label>
        <button type="submit" className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Update password</button>
      </form>
    </main>
  );
}
