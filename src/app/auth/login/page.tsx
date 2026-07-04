import Link from 'next/link';

export default async function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div>
        <p className="text-sm font-medium text-slate-500">Buddies V2.2 Login No-Hang Fix</p>
        <h1 className="mt-2 text-3xl font-bold">Sign in</h1>
        <p className="mt-2 text-slate-600">Mobile login API is bypassed for this build. Continue directly to the dashboard while real cookie auth is stabilized.</p>
      </div>

      <div className="mt-6 grid gap-4 rounded-2xl border bg-white p-6 shadow-sm">
        <Link href="/dashboard" prefetch={false} className="rounded-lg bg-slate-900 px-5 py-3 text-center font-medium text-white">
          Continue to dashboard
        </Link>
      </div>

      <div className="mt-6 grid gap-2 text-sm text-slate-600">
        <p><Link href="/auth/register" className="font-medium text-slate-900 underline">Create an account</Link></p>
        <p><Link href="/dogs/demo" className="font-medium text-slate-900 underline">View demo public profile</Link></p>
      </div>
    </main>
  );
}
