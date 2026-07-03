export const dynamic = 'force-static';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm font-medium text-slate-500">Buddies V2.2 Login Fix</p>
      <h1 className="mt-2 text-5xl font-bold tracking-tight">Sign in</h1>
      <p className="mt-5 text-lg text-slate-600">Access your dogs, QR profiles, dashboard, and public safety records.</p>
      <section className="mt-10 rounded-2xl border bg-white p-6 shadow-sm">
        <a href="https://buddies.vercel.app/dashboard" className="block w-full rounded-xl bg-slate-900 px-5 py-4 text-center font-medium text-white">Continue to dashboard</a>
      </section>
      <div className="mt-8 space-y-4 text-lg">
        <a href="https://buddies.vercel.app/dogs/demo" className="block text-slate-900 underline">View demo public profile</a>
      </div>
    </main>
  );
}
