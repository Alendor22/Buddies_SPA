import Link from 'next/link';

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Buddies V2.2</p>
          <h1 className="text-3xl font-bold">Dashboard</h1>
        </div>
        <Link href="/" className="rounded-lg border px-4 py-2">Home</Link>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Link href="/dogs" className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">My dogs</h2><p className="mt-2 text-slate-600">Profiles, QR codes, and safety records.</p></Link>
        <Link href="/dashboard/buddies" className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">Buddies</h2><p className="mt-2 text-slate-600">Social graph and pending items.</p></Link>
        <Link href="/dashboard/packs" className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">Packs</h2><p className="mt-2 text-slate-600">Pack members and activity feed.</p></Link>
      </div>
    </main>
  );
}
