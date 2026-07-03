import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
      <p className="text-sm font-medium text-slate-500">Buddies V2.1</p>
      <h1 className="mt-2 text-3xl font-bold">Page not found</h1>
      <p className="mt-3 text-slate-600">This profile or page is unavailable. Check the link or return to the dashboard.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/dashboard" className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Dashboard</Link>
        <Link href="/dogs" className="rounded-lg border px-5 py-3 font-medium">Browse dogs</Link>
      </div>
    </main>
  );
}
