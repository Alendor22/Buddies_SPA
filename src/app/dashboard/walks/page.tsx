import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function WalksPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const walks = await prisma.walk.findMany({
    where: { OR: [{ requesterId: user.id }, { walkerId: user.id }] },
    orderBy: { startsAt: 'desc' },
    take: 30,
    include: { dog: { select: { name: true, slug: true, breed: true } }, requester: { select: { id: true, displayName: true } }, walker: { select: { id: true, displayName: true } } }
  }).catch(() => []);

  const active = walks.filter((walk) => ['REQUESTED', 'ACCEPTED', 'ACTIVE'].includes(walk.status));

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Buddies Phase 1 Walks</p>
          <h1 className="text-3xl font-bold">Walks</h1>
          <p className="mt-2 text-slate-600">Create, review, and track requested dog walks. Production mapping is parked for a later rewrite.</p>
        </div>
        <Link href="/dashboard/walks/new" className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white">Create walk</Link>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Total walks</p><p className="mt-2 text-3xl font-bold">{walks.length}</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Active</p><p className="mt-2 text-3xl font-bold">{active.length}</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Completed</p><p className="mt-2 text-3xl font-bold">{walks.filter((walk) => walk.status === 'COMPLETED').length}</p></article>
      </section>

      <section className="mt-8 grid gap-4">
        {walks.length === 0 ? <div className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">No walks yet</h2><p className="mt-2 text-slate-600">Create your first walk request from the composer.</p></div> : walks.map((walk) => (
          <article key={walk.id} className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{walk.dog.name}</h2>
                <p className="mt-1 text-sm text-slate-600">{walk.dog.breed ?? 'Breed not listed'} · {walk.startsAt.toLocaleString()} · {walk.durationMin} min</p>
                <p className="mt-1 text-sm font-semibold">{walk.status}</p>
              </div>
              <Link href={`/dogs/${walk.dog.slug}`} className="rounded-lg border px-4 py-2 text-sm font-medium">Dog profile</Link>
            </div>
            {walk.notes ? <pre className="mt-4 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs text-slate-700">{walk.notes}</pre> : null}
          </article>
        ))}
      </section>
    </main>
  );
}
