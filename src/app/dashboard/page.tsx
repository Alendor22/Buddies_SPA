import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <p className="text-sm font-medium text-slate-500">Buddies V2.2 Milestone 3 Cloudflare Access</p>
        <h1 className="mt-2 text-3xl font-bold">Account required</h1>
        <p className="mt-3 text-slate-600">Use Cloudflare Access in front of this app, or create/sign in with the fallback form.</p>
        <Link href="/auth/login" className="mt-6 rounded-lg bg-slate-900 px-5 py-3 text-center font-medium text-white">Sign in</Link>
        <Link href="/auth/register" className="mt-3 rounded-lg border px-5 py-3 text-center font-medium">Create account</Link>
      </main>
    );
  }

  const dogs = await prisma.dog.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, slug: true, breed: true, status: true }
  });

  const [buddyCount, incomingBuddyCount] = await Promise.all([
    prisma.buddy.count({ where: { OR: [{ userAId: user.id }, { userBId: user.id }] } }),
    prisma.buddyRequest.count({ where: { receiverId: user.id, status: 'PENDING' } })
  ]).catch(() => [0, 0]);

  const lostCount = dogs.filter((dog) => dog.status !== 'SAFE').length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Buddies V2.2 Dog Ownership + Edit Fix</p>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-2 text-slate-600">Signed in as {user.displayName} ({user.email}). Manage dogs, QR pages, public safety records, and buddy connections.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dogs/new" className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white">Add dog</Link>
          <Link href="/dashboard/buddies" className="rounded-lg border px-4 py-2">Buddies</Link>
          <Link href="/dogs" className="rounded-lg border px-4 py-2">Browse dogs</Link>
        </div>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-4">
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Profiles</p><p className="mt-2 text-3xl font-bold">{dogs.length}</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Buddies</p><p className="mt-2 text-3xl font-bold">{buddyCount}</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Requests</p><p className="mt-2 text-3xl font-bold">{incomingBuddyCount}</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Safety alerts</p><p className="mt-2 text-3xl font-bold">{lostCount}</p></article>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><h2 className="text-2xl font-semibold">My dogs</h2><p className="mt-1 text-slate-600">Open a public profile, manage details, or show the QR page.</p></div>
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
                  <Link href={`/dogs/edit?slug=${dog.slug}`} className="rounded-lg border px-3 py-2">Edit</Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
