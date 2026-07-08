import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { UI_ROUTES, walkMessagesRoute } from '@/lib/uiRoutes';
import { walkParticipantWhere } from '@/lib/walkVisibility';

export const dynamic = 'force-dynamic';

export default async function MessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const walks = await prisma.walk.findMany({
    where: walkParticipantWhere(user.id),
    orderBy: { updatedAt: 'desc' },
    take: 50,
    include: {
      dog: { select: { name: true, photoUrl: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      notifications: {
        where: { userId: user.id, routeKey: 'messages', readAt: null },
        select: { id: true }
      }
    }
  });

  const unreadTotal = walks.reduce((sum, walk) => sum + walk.notifications.length, 0);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Buddies Phase 2 Messaging</p>
          <h1 className="mt-1 text-3xl font-bold">Messages</h1>
          <p className="mt-2 text-slate-600">Walk conversations with persisted history, accepted-participant access, and live updates.</p>
        </div>
        <div className="flex gap-2"><Link href={UI_ROUTES.walks} className="rounded-lg border px-4 py-2">Walks</Link><Link href={UI_ROUTES.dashboard} className="rounded-lg border px-4 py-2">Dashboard</Link></div>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Threads</p><p className="mt-2 text-3xl font-bold">{walks.length}</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Unread</p><p className="mt-2 text-3xl font-bold">{unreadTotal}</p></article>
      </section>

      <section className="mt-8 grid gap-3">
        {walks.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">No walk conversations</h2><p className="mt-2 text-slate-600">A thread becomes available when you create a walk or accept a walk invitation.</p><Link href={UI_ROUTES.createWalk} className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 font-medium text-white">Create walk</Link></div>
        ) : walks.map((walk) => {
          const lastMessage = walk.messages[0];
          const unread = walk.notifications.length;
          return (
            <Link key={walk.id} href={walkMessagesRoute(walk.id)} className="rounded-2xl border bg-white p-5 shadow-sm active:bg-slate-50">
              <div className="flex items-start gap-4">
                {walk.dog.photoUrl ? <img src={walk.dog.photoUrl} alt={`${walk.dog.name} profile`} className="h-14 w-14 rounded-full object-cover" /> : <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-900 text-2xl text-white">🐶</div>}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{walk.dog.name} walk chat</h2><p className="text-sm text-slate-600">{walk.startsAt.toLocaleString()} · {walk.status}</p></div>{unread ? <span className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold text-white">{unread}</span> : null}</div>
                  <p className="mt-2 truncate text-sm text-slate-700">{lastMessage?.body ?? 'No messages yet.'}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
