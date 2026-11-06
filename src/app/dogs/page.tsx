import Image from 'next/image';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function DogsPage() {
  const user = await getCurrentUser();
  const dogs = await prisma.dog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, ownerId: true, name: true, slug: true, breed: true, status: true, photoUrl: true }
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Buddies public dog directory</p>
          <h1 className="text-3xl font-bold">Dogs</h1>
          <p className="mt-2 text-slate-600">Browse public dog profiles. Profile management remains limited to the owning account.</p>
        </div>
        <Link href={user ? '/dashboard' : '/auth/login'} className="rounded-lg border px-4 py-2">{user ? 'Dashboard' : 'Sign in'}</Link>
      </div>

      {dogs.length === 0 ? (
        <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">No dog profiles yet</h2>
          <p className="mt-2 text-slate-600">Create the first public dog profile.</p>
          <Link href={user ? '/dogs/new' : '/auth/register'} className="mt-5 inline-block rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">{user ? 'Add dog' : 'Create account'}</Link>
        </section>
      ) : (
        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {dogs.map((dog) => {
            const isOwner = Boolean(user && dog.ownerId === user.id);
            return (
              <article key={dog.id} className="rounded-2xl border bg-white p-6 shadow-sm">
                <Link href={`/dogs/${dog.slug}`} className="flex items-center gap-4">
                  {dog.photoUrl ? <Image src={dog.photoUrl} alt={`${dog.name} profile`} width={64} height={64} unoptimized className="h-16 w-16 shrink-0 rounded-full object-cover" /> : <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 text-2xl text-white">🐶</div>}
                  <div><h2 className="text-xl font-semibold">{dog.name}</h2><p className="mt-1 text-slate-600">{dog.breed ?? 'Breed not listed'} · {dog.status}</p></div>
                </Link>
                <div className={`mt-5 grid gap-2 text-center text-sm ${isOwner ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <Link href={`/dogs/${dog.slug}`} className="rounded-lg border px-3 py-2">Profile</Link>
                  {isOwner ? <Link href={`/dogs/edit?slug=${encodeURIComponent(dog.slug)}`} className="rounded-lg border px-3 py-2">Edit</Link> : <Link href={user ? `/dashboard/messages?search=${encodeURIComponent(dog.name)}` : `/sign-in?redirect_url=${encodeURIComponent(`/dashboard/messages?search=${dog.name}`)}`} className="rounded-lg bg-slate-900 px-3 py-2 text-white">Message {dog.name}</Link>}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
