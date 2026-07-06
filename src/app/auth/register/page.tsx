import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSession, hashPassword, normalizeEmail } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function registerAction(formData: FormData) {
  'use server';

  const displayName = String(formData.get('displayName') ?? '').trim();
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  const password = String(formData.get('password') ?? '');

  if (!displayName || !email || password.length < 8) redirect('/auth/register?error=invalid');

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) redirect('/auth/login?error=exists');

  const user = await prisma.user.create({
    data: { email, displayName, passwordHash: hashPassword(password), emailVerifiedAt: new Date() },
    select: { id: true }
  });

  await createSession(user.id);
  redirect('/dashboard?registered=1');
}

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div>
        <p className="text-sm font-medium text-slate-500">Buddies V2.3 Mobile Registration</p>
        <h1 className="mt-2 text-3xl font-bold">Create account</h1>
        <p className="mt-2 text-slate-600">Create an owner account and sign in without using a route handler.</p>
      </div>
      {error ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Enter a valid name, email, and password of at least 8 characters.</div> : null}
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
