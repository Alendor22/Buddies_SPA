import Link from 'next/link';

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div>
        <p className="text-sm font-medium text-slate-500">Buddies V2</p>
        <h1 className="mt-2 text-3xl font-bold">Create account</h1>
        <p className="mt-2 text-slate-600">Start managing dog profiles and public safety cards.</p>
      </div>

      {error ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error === 'exists' ? 'That email is already registered.' : 'Enter a name, email, and password of at least 8 characters.'}
        </div>
      ) : null}

      <form action="/api/auth/register" method="post" className="mt-6 grid gap-4 rounded-2xl border bg-white p-6 shadow-sm">
        <label className="grid gap-2 text-sm font-medium">
          Display name
          <input name="displayName" required className="rounded-lg border px-3 py-3 text-base" />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Email
          <input name="email" type="email" required className="rounded-lg border px-3 py-3 text-base" />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Password
          <input name="password" type="password" required minLength={8} className="rounded-lg border px-3 py-3 text-base" />
        </label>
        <button className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Create account</button>
      </form>

      <p className="mt-6 text-sm text-slate-600">
        Already registered? <Link href="/auth/login" className="font-medium text-slate-900 underline">Sign in</Link>
      </p>
    </main>
  );
}
