import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const [incomingRequests, alertDogs] = await Promise.all([
    prisma.buddyRequest.findMany({
      where: { receiverId: user.id, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: { sender: { select: { displayName: true, email: true } } }
    }),
    prisma.dog.findMany({
      where: { ownerId: user.id, NOT: { status: 'SAFE' } },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, slug: true, status: true, updatedAt: true }
    })
  ]).catch(() => [[], []] as const);

  const total = incomingRequests.length + alertDogs.length;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Buddies V2.2 Dynamic Notifications</p>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="mt-2 text-slate-600">Live account alerts for buddy requests and dog safety statuses.</p>
        </div>
        <Link href="/dashboard" className="rounded-lg border px-4 py-2">Dashboard</Link>
      </div>

      <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Open notifications</p>
        <p className="mt-2 text-4xl font-bold">{total}</p>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Buddy requests</h2>
          <div className="mt-4 grid gap-3">
            {incomingRequests.length === 0 ? <p className="text-sm text-slate-600">No pending buddy requests.</p> : incomingRequests.map((request) => (
              <article key={request.id} className="rounded-xl border p-4">
                <h3 className="font-semibold">{request.sender.displayName}</h3>
                <p className="text-sm text-slate-600">{request.sender.email}</p>
                <Link href="/dashboard/buddies" className="mt-3 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Review request</Link>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Safety alerts</h2>
          <div className="mt-4 grid gap-3">
            {alertDogs.length === 0 ? <p className="text-sm text-slate-600">No active dog safety alerts.</p> : alertDogs.map((dog) => (
              <article key={dog.id} className="rounded-xl border p-4">
                <h3 className="font-semibold">{dog.name}</h3>
                <p className="text-sm text-slate-600">Status: {dog.status}</p>
                <Link href={`/dogs/${dog.slug}`} className="mt-3 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Open profile</Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
