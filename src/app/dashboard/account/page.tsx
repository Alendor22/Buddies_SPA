import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const [dogCount, buddyCount, pendingCount, alertCount] = await Promise.all([
    prisma.dog.count({ where: { ownerId: user.id } }),
    prisma.buddy.count({ where: { OR: [{ userAId: user.id }, { userBId: user.id }] } }),
    prisma.buddyRequest.count({ where: { receiverId: user.id, status: 'PENDING' } }),
    prisma.dog.count({ where: { ownerId: user.id, NOT: { status: 'SAFE' } } })
  ]).catch(() => [0, 0, 0, 0]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-sm font-medium text-slate-500">Buddies V2.2 Milestone 3.2 Account Menu</p>
      <h1 className="mt-2 text-3xl font-bold">Account</h1>
      <p className="mt-2 text-slate-600">Manage the active Buddies session and account-bound navigation.</p>

      <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-xl font-bold text-white">
            {user.displayName.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-semibold">{user.displayName}</h2>
            <p className="text-slate-600">{user.email}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <article className="rounded-xl border p-4"><p className="text-sm text-slate-500">Dogs</p><p className="text-2xl font-bold">{dogCount}</p></article>
          <article className="rounded-xl border p-4"><p className="text-sm text-slate-500">Buddies</p><p className="text-2xl font-bold">{buddyCount}</p></article>
          <article className="rounded-xl border p-4"><p className="text-sm text-slate-500">Requests</p><p className="text-2xl font-bold">{pendingCount}</p></article>
          <article className="rounded-xl border p-4"><p className="text-sm text-slate-500">Alerts</p><p className="text-2xl font-bold">{alertCount}</p></article>
        </div>
      </section>

      <section className="mt-6 grid gap-3 rounded-2xl border bg-white p-6 shadow-sm">
        <Link href="/dashboard" className="rounded-lg border px-4 py-3 font-medium">Dashboard</Link>
        <Link href="/dogs" className="rounded-lg border px-4 py-3 font-medium">My dogs</Link>
        <Link href="/dashboard/notifications" className="rounded-lg border px-4 py-3 font-medium">Notifications</Link>
        <Link href="/api/auth/logout" className="rounded-lg bg-red-600 px-4 py-3 text-center font-medium text-white">Sign out</Link>
      </section>
    </main>
  );
}
