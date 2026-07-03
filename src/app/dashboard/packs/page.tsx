import Link from 'next/link';
import { prisma } from '@/lib/db';
import { DEMO_USER_ID } from '@/lib/demo-user';
import { joinPack, leavePack } from './actions';

export const dynamic = 'force-dynamic';

export default async function PacksPage() {
  const packs = await prisma.pack.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      owner: { select: { displayName: true } },
      memberships: {
        include: {
          user: { select: { id: true, displayName: true } },
          dog: { select: { name: true, breed: true } }
        },
        orderBy: { createdAt: 'asc' }
      },
      posts: {
        orderBy: { createdAt: 'desc' },
        take: 3,
        include: { author: { select: { displayName: true } } }
      }
    }
  });

  const joinedCount = packs.filter((pack) => pack.memberships.some((member) => member.userId === DEMO_USER_ID)).length;
  const postCount = packs.reduce((total, pack) => total + pack.posts.length, 0);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Buddies V2.2</p>
          <h1 className="text-3xl font-bold">Packs</h1>
          <p className="mt-2 text-slate-600">Seeded pack membership and activity feed.</p>
        </div>
        <Link href="/dashboard" className="rounded-lg border px-4 py-2">Dashboard</Link>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-6 shadow-sm"><p className="text-sm text-slate-500">Total packs</p><p className="mt-2 text-3xl font-bold">{packs.length}</p></div>
        <div className="rounded-2xl border bg-white p-6 shadow-sm"><p className="text-sm text-slate-500">My packs</p><p className="mt-2 text-3xl font-bold">{joinedCount}</p></div>
        <div className="rounded-2xl border bg-white p-6 shadow-sm"><p className="text-sm text-slate-500">Recent posts</p><p className="mt-2 text-3xl font-bold">{postCount}</p></div>
      </section>

      <section className="mt-8 grid gap-6">
        {packs.length === 0 ? <p className="rounded-2xl border bg-white p-6 text-slate-600 shadow-sm">No packs yet. Run the seed workflow after deployment.</p> : packs.map((pack) => {
          const isMember = pack.memberships.some((member) => member.userId === DEMO_USER_ID);
          return (
            <article key={pack.id} className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                <div>
                  <p className="text-sm font-medium text-slate-500">{pack.city ?? 'No city'} · Owner: {pack.owner?.displayName ?? 'Unassigned'}</p>
                  <h2 className="mt-1 text-2xl font-bold">{pack.name}</h2>
                  <p className="mt-2 max-w-2xl text-slate-600">{pack.description ?? 'No description provided.'}</p>
                </div>
                <form action={isMember ? leavePack : joinPack}>
                  <input type="hidden" name="packId" value={pack.id} />
                  <button className={isMember ? 'rounded-lg border px-4 py-2' : 'rounded-lg bg-slate-900 px-4 py-2 text-white'}>{isMember ? 'Leave pack' : 'Join pack'}</button>
                </form>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div>
                  <h3 className="font-semibold">Members</h3>
                  <div className="mt-3 grid gap-2">
                    {pack.memberships.map((member) => (
                      <div key={member.id} className="rounded-xl border p-3 text-sm">
                        <span className="font-medium">{member.user.displayName}</span>
                        <span className="text-slate-500"> · {member.role} · {member.dog?.name ?? 'No dog selected'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold">Feed</h3>
                  <div className="mt-3 grid gap-2">
                    {pack.posts.length === 0 ? <p className="text-sm text-slate-600">No posts yet.</p> : pack.posts.map((post) => (
                      <div key={post.id} className="rounded-xl border p-3 text-sm">
                        <p className="font-medium">{post.title}</p>
                        <p className="text-slate-600">{post.body ?? 'No body.'}</p>
                        <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{post.kind} · {post.author.displayName}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
