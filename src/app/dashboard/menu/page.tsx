import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function MenuPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const [buddyRequests, dogAlerts, walkInvites] = await Promise.all([
    prisma.buddyRequest.count({ where: { receiverId: user.id, status: 'PENDING' } }),
    prisma.dog.count({ where: { ownerId: user.id, NOT: { status: 'SAFE' } } }),
    prisma.walk.count({ where: { OR: [{ requesterId: user.id }, { walkerId: user.id }], status: { in: ['REQUESTED', 'ACCEPTED', 'ACTIVE'] } } })
  ]).catch(() => [0, 0, 0] as const);
  const total = buddyRequests + dogAlerts + walkInvites;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-sm font-medium text-slate-500">Buddies Phase 1 Menu</p>
      <h1 className="mt-2 text-3xl font-bold">Menu</h1>
      <p className="mt-2 text-slate-600">Signed in as {user.displayName}. Choose an area below.</p>

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="text-xl font-semibold">Badge breakdown</h2><p className="mt-1 text-sm text-slate-600">The red badge on the account icon is the total open item count.</p></div>
          <span className="rounded-full bg-red-600 px-3 py-1 text-sm font-bold text-white">{total}</span>
        </div>
        <div className="mt-4 grid gap-2 text-sm">
          <Link href="/dashboard/buddies" className="rounded-lg border px-4 py-3">Buddy requests: {buddyRequests}</Link>
          <Link href="/dashboard/notifications" className="rounded-lg border px-4 py-3">Dog alerts: {dogAlerts}</Link>
          <Link href="/dashboard/walks" className="rounded-lg border px-4 py-3">Walk invites: {walkInvites}</Link>
        </div>
      </section>

      <section className="mt-6 grid gap-3 rounded-2xl border bg-white p-6 shadow-sm">
        <Link href="/dashboard" className="rounded-lg border px-4 py-4 font-medium">Dashboard</Link>
        <Link href="/dogs" className="rounded-lg border px-4 py-4 font-medium">Profiles</Link>
        <Link href="/dogs/new" className="rounded-lg border px-4 py-4 font-medium">Add dog</Link>
        <Link href="/dashboard/buddies" className="rounded-lg border px-4 py-4 font-medium">Buddies social graph</Link>
        <Link href="/dashboard/walks" className="rounded-lg border px-4 py-4 font-medium">Walks</Link>
        <Link href="/dashboard/lost/report" className="rounded-lg border px-4 py-4 font-medium">Lost dog mode</Link>
        <Link href="/dashboard/records" className="rounded-lg border px-4 py-4 font-medium">Vet records</Link>
        <Link href="/dashboard/notifications" className="rounded-lg border px-4 py-4 font-medium">Notifications</Link>
        <a href="/logout" className="rounded-lg bg-red-600 px-4 py-4 text-center font-medium text-white">Sign out</a>
      </section>
    </main>
  );
}
