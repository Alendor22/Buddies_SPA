import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const currentUser = await getCurrentUser();
  const seededUser = currentUser ?? await prisma.user.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true, displayName: true, role: true }
  });

  const isRealSession = Boolean(currentUser);
  const user = seededUser
    ? { ...seededUser, role: seededUser.role.toString() }
    : { id: '', email: 'demo@buddies.local', displayName: 'Demo User', role: 'OWNER' };

  const dogs = user.id
    ? await prisma.dog.findMany({
        where: { ownerId: user.id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, slug: true, breed: true, status: true }
      })
    : [];

  const buddyCounts = user.id
    ? await Promise.all([
        prisma.buddy.count({ where: { OR: [{ userAId: user.id }, { userBId: user.id }] } }),
        prisma.buddyRequest.count({ where: { receiverId: user.id, status: 'PENDING' } })
      ]).catch(() => [0, 0])
    : [0, 0];

  const [buddyCount, incomingBuddyCount] = buddyCounts;
  const lostCount = dogs.filter((dog) => dog.status !== 'SAFE').length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Buddies V2.2 Dashboard + Add Dog No-Auth Fix</p>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-2 text-slate-600">
            {isRealSession ? `Signed in as ${user.displayName}.` : `Demo access as ${user.displayName}; session cookie is not active.`} Manage dogs, QR pages, public safety records, and buddy connections.
          </p>
          {!isRealSession ? (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Current mode: dashboard bypass. Add Dog and QR are enabled without login while mobile auth is being stabilized.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dogs/new" className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white">Add dog</Link>
          <Link href="/dashboard/buddies" className="rounded-lg border px-4 py-2">Buddies</Link>
          <Link href="/dogs" className="rounded-lg border px-4 py-2">Browse dogs</Link>
        </div>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-4">
        <article className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Profiles</p>
          <p className="mt-2 text-3xl font-bold">{dogs.length}</p>
        </article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Buddies</p>
          <p className="mt-2 text-3xl font-bold">{buddyCount}</p>
        </article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Requests</p>
          <p className="mt-2 text-3xl font-bold">{incomingBuddyCount}</p>
        </article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Safety alerts</p>
          <p className="mt-2 text-3xl font-bold">{lostCount}</p>
        </article>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">My dogs</h2>
            <p className="mt-1 text-slate-600">Open a public profile, manage details, or show the QR page.</p>
          </div>
          <Link href="/dogs/new" className="text-sm font-medium underline">Create another profile</Link>
        </div>

        {dogs.length === 0 ? (
          <div className="mt-5 rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold">No dogs added yet</h3>
            <p className="mt-2 text-slate-600">Create your first dog profile to generate a public safety record and QR page.</p>
            <Link href="/dogs/new" className="mt-5 inline-block rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Create dog profile</Link>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {dogs.map((dog) => (
              <article key={dog.id} className="rounded-2xl border bg-white p-5 shadow-sm">
                <h3 className="text-xl font-semibold">{dog.name}</h3>
                <p className="mt-1 text-slate-600">{dog.breed ?? 'Breed not listed'}</p>
                <p className="mt-3 text-sm font-semibold">{dog.status}</p>
                <div className="mt-5 grid grid-cols-3 gap-2 text-center text-sm">
                  <Link href={`/dogs/${dog.slug}`} className="rounded-lg border px-3 py-2">Profile</Link>
                  <Link href={`/dogs/${dog.slug}/qr`} className="rounded-lg border px-3 py-2">QR</Link>
                  <Link href={`/dogs/${dog.slug}/edit`} className="rounded-lg border px-3 py-2">Edit</Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
