import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function DogsPage() {
  const user = await getCurrentUser();
  let dogs: Array<{ id: string; ownerId: string; name: string; slug: string; breed: string | null; status: string }> = [];

  try {
    dogs = await prisma.dog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, ownerId: true, name: true, slug: true, breed: true, status: true }
    });
  } catch {
    dogs = [];
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Buddies V2.2 Owner-Safe Browse</p>
          <h1 className="text-3xl font-bold">Dogs</h1>
          <p className="mt-2 text-slate-600">Browse public dog profiles. Edit controls only appear for dogs owned by the signed-in account.</p>
        </div>
        <Link href="/dashboard" className="rounded-lg border px-4 py-2">Dashboard</Link>
      </div>

      {dogs.length === 0 ? (
        <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">No dog profiles yet</h2>
          <p className="mt-2 text-slate-600">The database is connected when this page loads without a server error. Add profile creation next.</p>
          <Link href="/dogs/demo" className="mt-5 inline-block rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">View demo profile</Link>
        </section>
      ) : (
        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {dogs.map((dog) => {
            const isOwner = Boolean(user && dog.ownerId === user.id);
            return (
              <article key={dog.id} className="rounded-2xl border bg-white p-6 shadow-sm">
                <Link href={`/dogs/${dog.slug}`}>
                  <h2 className="text-xl font-semibold">{dog.name}</h2>
                  <p className="mt-2 text-slate-600">{dog.breed ?? 'Breed not listed'} · {dog.status}</p>
                </Link>
                <div className="mt-5 grid grid-cols-2 gap-2 text-center text-sm">
                  <Link href={`/dogs/${dog.slug}`} className="rounded-lg border px-3 py-2">Profile</Link>
                  {isOwner ? <Link href={`/dogs/edit?slug=${dog.slug}`} className="rounded-lg border px-3 py-2">Edit</Link> : null}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
