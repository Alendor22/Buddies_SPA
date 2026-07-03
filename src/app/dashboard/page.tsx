import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const dogs = await prisma.dog.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, slug: true, breed: true, status: true, photoUrl: true }
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Buddies V2</p>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-2 text-slate-600">Signed in as {user.displayName}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dogs/new" className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white">Add dog</Link>
          <form action="/api/session/end" method="post">
            <button className="rounded-lg border px-4 py-2">Sign out</button>
          </form>
        </div>
      </div>

      <section className="mt-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">My dogs</h2>
            <p className="mt-1 text-slate-600">Manage profiles, safety information, and public IDs.</p>
          </div>
          <Link href="/dogs" className="text-sm font-medium underline">Browse all dogs</Link>
        </div>

        {dogs.length === 0 ? (
          <div className="mt-5 rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold">No dogs added yet</h3>
            <p className="mt-2 text-slate-600">Create your first dog profile to generate a public safety record.</p>
            <Link href="/dogs/new" className="mt-5 inline-block rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Create dog profile</Link>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {dogs.map((dog) => (
              <Link key={dog.id} href={`/dogs/${dog.slug}`} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                {dog.photoUrl ? <img src={dog.photoUrl} alt="" className="h-44 w-full object-cover" /> : null}
                <div className="p-5">
                  <h3 className="text-xl font-semibold">{dog.name}</h3>
                  <p className="mt-2 text-slate-600">{dog.breed ?? 'Breed not listed'} · {dog.status}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Walks</h2>
          <p className="mt-2 text-slate-600">Requests, scheduling, and messaging are the next application layer.</p>
        </article>
        <article className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Nearby</h2>
          <p className="mt-2 text-slate-600">Map-based discovery follows completion of owner-managed dog profiles.</p>
        </article>
      </section>
    </main>
  );
}
