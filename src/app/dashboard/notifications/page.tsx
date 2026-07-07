import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const [incomingRequests, alertDogs, walks] = await Promise.all([
    prisma.buddyRequest.findMany({
      where: { receiverId: user.id, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: { sender: { select: { displayName: true, dogs: { select: { name: true, slug: true, breed: true, photoUrl: true }, take: 1 } } } }
    }),
    prisma.dog.findMany({
      where: { ownerId: user.id, NOT: { status: 'SAFE' } },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, slug: true, status: true, updatedAt: true, lastSeenLocation: true }
    }),
    prisma.walk.findMany({
      where: { OR: [{ requesterId: user.id }, { walkerId: user.id }], status: { in: ['REQUESTED', 'ACCEPTED', 'ACTIVE'] } },
      orderBy: { startsAt: 'asc' },
      take: 8,
      include: { dog: { select: { name: true, slug: true } } }
    })
  ]).catch(() => [[], [], []] as const);

  const total = incomingRequests.length + alertDogs.length + walks.length;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Buddies Phase 1 Notifications</p>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="mt-2 text-slate-600">Dog-first alerts for buddy requests, safety status, and active walks.</p>
        </div>
        <div className="flex flex-wrap gap-2"><Link href="/dashboard" className="rounded-lg border px-4 py-2">Dashboard</Link><Link href="/dashboard/lost/report" className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white">Lost dog</Link></div>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-4">
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Open</p><p className="mt-2 text-4xl font-bold">{total}</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Buddy requests</p><p className="mt-2 text-4xl font-bold">{incomingRequests.length}</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Safety</p><p className="mt-2 text-4xl font-bold">{alertDogs.length}</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Walks</p><p className="mt-2 text-4xl font-bold">{walks.length}</p></article>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Buddy requests</h2>
          <div className="mt-4 grid gap-3">
            {incomingRequests.length === 0 ? <p className="text-sm text-slate-600">No pending buddy requests.</p> : incomingRequests.map((request) => {
              const dog = request.sender.dogs[0];
              return <article key={request.id} className="rounded-xl border p-4"><h3 className="font-semibold">{dog?.name ?? 'Dog profile'}</h3><p className="text-sm text-slate-600">{dog?.breed ?? 'Breed hidden'} · owner hidden</p><Link href="/dashboard/buddies" className="mt-3 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Review request</Link></article>;
            })}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Safety alerts</h2>
          <div className="mt-4 grid gap-3">
            {alertDogs.length === 0 ? <p className="text-sm text-slate-600">No active dog safety alerts.</p> : alertDogs.map((dog) => (
              <article key={dog.id} className="rounded-xl border p-4"><h3 className="font-semibold">{dog.name}</h3><p className="text-sm text-slate-600">Status: {dog.status}{dog.lastSeenLocation ? ` · ${dog.lastSeenLocation}` : ''}</p><Link href={`/dogs/${dog.slug}`} className="mt-3 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Open profile</Link></article>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Active walks</h2>
          <div className="mt-4 grid gap-3">
            {walks.length === 0 ? <p className="text-sm text-slate-600">No active walk alerts.</p> : walks.map((walk) => <article key={walk.id} className="rounded-xl border p-4"><h3 className="font-semibold">{walk.dog.name}</h3><p className="text-sm text-slate-600">{walk.status} · {walk.startsAt.toLocaleString()}</p><Link href="/dashboard/walks" className="mt-3 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Open walks</Link></article>)}
          </div>
        </div>
      </section>
    </main>
  );
}
