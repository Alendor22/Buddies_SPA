import Link from 'next/link';
import { loginAction } from './actions';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; reset?: string }> }) {
  const { error, reset } = await searchParams;
  const errorMessage = error === 'missing'
    ? 'Email and password are required.'
    : error === 'throttled'
      ? 'Too many sign-in attempts. Wait a few minutes and try again.'
    : error === 'exists'
      ? 'An account already exists for that email. Sign in or reset the password.'
      : error
        ? 'Invalid email or password.'
        : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div>
        <p className="text-sm font-medium text-slate-500">Buddies secure sign in</p>
        <h1 className="mt-2 text-3xl font-bold">Sign in</h1>
        <p className="mt-2 text-slate-600">Sign in with a verified account to manage your dogs, QR profiles, and safety records.</p>
      </div>

      {reset ? <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Your password was updated. Sign in with the new password.</div> : null}
      {errorMessage ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMessage}</div> : null}

      <form action={loginAction} className="mt-6 grid gap-4 rounded-2xl border bg-white p-6 shadow-sm">
        <label className="grid gap-2 text-sm font-medium">Email<input name="email" type="email" autoComplete="email" required className="rounded-lg border px-3 py-3 text-base" /></label>
        <label className="grid gap-2 text-sm font-medium">Password<input name="password" type="password" autoComplete="current-password" required className="rounded-lg border px-3 py-3 text-base" /></label>
        <div className="flex justify-end"><Link href="/auth/forgot-password" className="text-sm font-medium text-slate-900 underline">Forgot password?</Link></div>
        <button type="submit" className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Sign in</button>
      </form>

      <div className="mt-6 grid gap-2 text-sm text-slate-600">
        <p>New to Buddies? <Link href="/auth/register" className="font-medium text-slate-900 underline">Create an account</Link></p>
        <p><Link href="/dogs" className="font-medium text-slate-900 underline">Browse public dog profiles</Link></p>
      </div>
    </main>
  );
}
