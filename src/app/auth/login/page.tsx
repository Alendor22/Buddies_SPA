import Link from 'next/link';
import { loginAction } from './actions';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div>
        <p className="text-sm font-medium text-slate-500">Buddies V2.2 Server Action Login</p>
        <h1 className="mt-2 text-3xl font-bold">Sign in</h1>
        <p className="mt-2 text-slate-600">Sign in with your account to manage only your dogs, QR profiles, and safety records.</p>
      </div>

      {error ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error === 'missing' ? 'Email and password are required.' : 'Invalid email or password.'}
        </div>
      ) : null}

      <form action={loginAction} className="mt-6 grid gap-4 rounded-2xl border bg-white p-6 shadow-sm">
        <label className="grid gap-2 text-sm font-medium">
          Email
          <input name="email" type="email" autoComplete="email" required className="rounded-lg border px-3 py-3 text-base" />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Password
          <input name="password" type="password" autoComplete="current-password" required className="rounded-lg border px-3 py-3 text-base" />
        </label>
        <button type="submit" className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Sign in</button>
      </form>

      <div className="mt-6 grid gap-2 text-sm text-slate-600">
        <p>New to Buddies? <Link href="/auth/register" className="font-medium text-slate-900 underline">Create an account</Link></p>
        <p><Link href="/dogs/demo" className="font-medium text-slate-900 underline">View demo public profile</Link></p>
      </div>
    </main>
  );
}
