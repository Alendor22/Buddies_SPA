import Link from 'next/link';

export const dynamic = 'force-static';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm font-medium text-slate-500">Buddies V2.2</p>
      <h1 className="mt-2 text-5xl font-bold tracking-tight">Sign in</h1>
      <p className="mt-5 text-lg text-slate-600">Access your dogs, QR profiles, dashboard, and public safety records.</p>

      <section className="mt-10 rounded-2xl border bg-white p-6 shadow-sm">
        <label className="block font-medium" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" defaultValue="motoscucci@yahoo.com" className="mt-3 w-full rounded-xl border px-4 py-3" />

        <label className="mt-6 block font-medium" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" className="mt-3 w-full rounded-xl border px-4 py-3" />

        <Link href="/dashboard" className="mt-6 block w-full rounded-xl bg-slate-900 px-5 py-4 text-center font-medium text-white">Sign in</Link>
      </section>

      <div className="mt-8 space-y-4 text-lg">
        <p className="text-slate-600">New to Buddies? <Link href="/dashboard" className="font-medium text-slate-900 underline">Create an account</Link></p>
        <Link href="/dogs/demo" className="block text-slate-900 underline">View demo public profile</Link>
      </div>
    </main>
  );
}
