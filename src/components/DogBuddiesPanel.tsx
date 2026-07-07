import Link from 'next/link';
import { prisma } from '@/lib/db';

export default async function DogBuddiesPanel({ dogId, dogName }: { dogId: string; dogName: string }) {
  const links = await prisma.dogBuddy.findMany({
    where: { OR: [{ dogAId: dogId }, { dogBId: dogId }] },
    orderBy: { createdAt: 'desc' },
    take: 24,
    include: {
      dogA: { select: { id: true, name: true, slug: true, breed: true, status: true, photoUrl: true } },
      dogB: { select: { id: true, name: true, slug: true, breed: true, status: true, photoUrl: true } }
    }
  }).catch(() => []);

  const buddies = links.map((link) => link.dogAId === dogId ? link.dogB : link.dogA);

  return (
    <section id="dog-buddies" className="mt-7 scroll-mt-24 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">{dogName}&apos;s buddies</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold">{buddies.length}</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {buddies.length === 0 ? <p className="text-sm text-slate-600">No accepted dog buddies yet.</p> : buddies.map((buddy) => (
          <Link key={buddy.id} href={`/dogs/${buddy.slug}`} className="flex gap-3 rounded-xl border bg-slate-50 p-3">
            {buddy.photoUrl ? <img src={buddy.photoUrl} alt={`${buddy.name} profile`} className="h-12 w-12 rounded-full object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-xl text-white">🐶</div>}
            <div className="min-w-0">
              <p className="font-semibold">{buddy.name}</p>
              <p className="truncate text-sm text-slate-600">{buddy.breed ?? 'Breed not listed'} · {buddy.status}</p>
              <p className="text-xs text-slate-500">Owner hidden</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
