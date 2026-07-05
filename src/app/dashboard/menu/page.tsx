import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function MenuPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-sm font-medium text-slate-500">Buddies V2.3 Mobile Menu</p>
      <h1 className="mt-2 text-3xl font-bold">Menu</h1>
      <p className="mt-2 text-slate-600">Signed in as {user.displayName}. Choose an area below.</p>
      <section className="mt-6 grid gap-3 rounded-2xl border bg-white p-6 shadow-sm">
        <Link href="/dashboard" className="rounded-lg border px-4 py-4 font-medium">Dashboard</Link>
        <Link href="/dogs" className="rounded-lg border px-4 py-4 font-medium">Profiles</Link>
        <Link href="/dogs/new" className="rounded-lg border px-4 py-4 font-medium">Add dog</Link>
        <Link href="/dashboard/buddies" className="rounded-lg border px-4 py-4 font-medium">Buddies social graph</Link>
        <Link href="/dashboard/notifications" className="rounded-lg border px-4 py-4 font-medium">Notifications</Link>
        <a href="/logout" className="rounded-lg bg-red-600 px-4 py-4 text-center font-medium text-white">Sign out</a>
      </section>
    </main>
  );
}
