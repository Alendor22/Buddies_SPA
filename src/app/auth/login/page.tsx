export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div>
        <p className="text-sm font-medium text-slate-500">Buddies V2.2 Login Fix</p>
        <h1 className="mt-2 text-3xl font-bold">Sign in</h1>
        <p className="mt-2 text-slate-600">Access your dogs, QR profiles, dashboard, and public safety records.</p>
      </div>

      <section className="mt-6 grid gap-4 rounded-2xl border bg-white p-6 shadow-sm">
        <a href="https://buddies.vercel.app/dashboard" className="rounded-lg bg-slate-900 px-5 py-3 text-center font-medium text-white">Continue to dashboard</a>
      </section>

      <div className="mt-6 grid gap-2 text-sm text-slate-600">
        <p><a href="https://buddies.vercel.app/dashboard" className="font-medium text-slate-900 underline">Create an account</a></p>
        <p><a href="https://buddies.vercel.app/dogs/demo" className="font-medium text-slate-900 underline">View demo public profile</a></p>
      </div>
    </main>
  );
}
