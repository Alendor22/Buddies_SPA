import Link from 'next/link';
import { FriendshipStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { DEMO_USER_ID } from '@/lib/demo-user';

export const dynamic = 'force-dynamic';

function dogList(dogs: Array<{ name: string }>) {
  return dogs.map((dog) => dog.name).join(', ') || 'None listed';
}

export default async function BuddiesPage() {
  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ requesterId: DEMO_USER_ID }, { addresseeId: DEMO_USER_ID }] },
    orderBy: { updatedAt: 'desc' },
    include: {
      requester: { select: { id: true, displayName: true, bio: true, dogs: { select: { name: true } } } },
      addressee: { select: { id: true, displayName: true, bio: true, dogs: { select: { name: true } } } }
    }
  });

  const accepted = friendships.filter((item) => item.status === FriendshipStatus.ACCEPTED);
  const inbound = friendships.filter((item) => item.status === FriendshipStatus.PENDING && item.addresseeId === DEMO_USER_ID);
  const outbound = friendships.filter((item) => item.status === FriendshipStatus.PENDING && item.requesterId === DEMO_USER_ID);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Buddies V2.2</p>
          <h1 className="text-3xl font-bold">Buddy network</h1>
          <p className="mt-2 text-slate-600">Seeded social graph for buddy connections.</p>
        </div>
        <Link href="/dashboard" className="rounded-lg border px-4 py-2">Dashboard</Link>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-6 shadow-sm"><p className="text-sm text-slate-500">Accepted buddies</p><p className="mt-2 text-3xl font-bold">{accepted.length}</p></div>
        <div className="rounded-2xl border bg-white p-6 shadow-sm"><p className="text-sm text-slate-500">Inbound pending</p><p className="mt-2 text-3xl font-bold">{inbound.length}</p></div>
        <div className="rounded-2xl border bg-white p-6 shadow-sm"><p className="text-sm text-slate-500">Outbound pending</p><p className="mt-2 text-3xl font-bold">{outbound.length}</p></div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Accepted buddies</h2>
          <div className="mt-4 grid gap-3">
            {accepted.length === 0 ? <p className="text-slate-600">No accepted buddies yet.</p> : accepted.map((item) => {
              const user = item.requesterId === DEMO_USER_ID ? item.addressee : item.requester;
              return <article key={item.id} className="rounded-xl border p-4"><h3 className="font-semibold">{user.displayName}</h3><p className="text-sm text-slate-600">{user.bio ?? 'No bio provided'}</p><p className="mt-2 text-sm text-slate-500">Dogs: {dogList(user.dogs)}</p></article>;
            })}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Pending queue</h2>
          <div className="mt-4 grid gap-3">
            {[...inbound, ...outbound].length === 0 ? <p className="text-slate-600">No pending items.</p> : [...inbound, ...outbound].map((item) => {
              const user = item.requesterId === DEMO_USER_ID ? item.addressee : item.requester;
              const direction = item.addresseeId === DEMO_USER_ID ? 'Inbound' : 'Outbound';
              return <article key={item.id} className="rounded-xl border p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{direction}</p><h3 className="mt-1 font-semibold">{user.displayName}</h3><p className="text-sm text-slate-600">{item.note ?? 'No note.'}</p></article>;
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
