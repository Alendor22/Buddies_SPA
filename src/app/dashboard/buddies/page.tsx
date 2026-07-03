import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

type SearchParams = {
  sent?: string;
  accepted?: string;
  declined?: string;
  cancelled?: string;
  removed?: string;
  error?: string;
};

function statusMessage(searchParams: SearchParams) {
  if (searchParams.sent) return 'Buddy request sent.';
  if (searchParams.accepted) return 'Buddy request accepted.';
  if (searchParams.declined) return 'Buddy request declined.';
  if (searchParams.cancelled) return 'Buddy request cancelled.';
  if (searchParams.removed) return 'Buddy removed.';
  if (searchParams.error === 'not-found') return 'No owner account exists for that email.';
  if (searchParams.error === 'exists') return 'That owner is already your buddy.';
  if (searchParams.error === 'invalid') return 'Enter another owner email address.';
  if (searchParams.error) return 'Unable to complete that buddy action.';
  return null;
}

export default async function BuddiesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const params = await searchParams;
  const message = statusMessage(params);

  const [incoming, outgoing, buddyLinks] = await Promise.all([
    prisma.buddyRequest.findMany({
      where: { receiverId: user.id, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: { sender: { select: { id: true, displayName: true, email: true, avatarUrl: true, dogs: { select: { id: true, name: true, slug: true }, take: 3 } } } }
    }),
    prisma.buddyRequest.findMany({
      where: { senderId: user.id, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: { receiver: { select: { id: true, displayName: true, email: true, avatarUrl: true, dogs: { select: { id: true, name: true, slug: true }, take: 3 } } } }
    }),
    prisma.buddy.findMany({
      where: { OR: [{ userAId: user.id }, { userBId: user.id }] },
      orderBy: { createdAt: 'desc' },
      include: {
        userA: { select: { id: true, displayName: true, email: true, avatarUrl: true, dogs: { select: { id: true, name: true, slug: true }, take: 3 } } },
        userB: { select: { id: true, displayName: true, email: true, avatarUrl: true, dogs: { select: { id: true, name: true, slug: true }, take: 3 } } }
      }
    })
  ]);

  const buddies = buddyLinks.map((link) => ({
    id: link.id,
    owner: link.userAId === user.id ? link.userB : link.userA
  }));

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Buddies V2.2</p>
          <h1 className="text-3xl font-bold">Buddies</h1>
          <p className="mt-2 text-slate-600">Connect with other owners, review pending requests, and manage your trusted dog network.</p>
        </div>
        <Link href="/dashboard" className="rounded-lg border px-4 py-2">Dashboard</Link>
      </div>

      {message ? <div className="mt-6 rounded-xl border bg-white p-4 text-sm text-slate-700 shadow-sm">{message}</div> : null}

      <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Send buddy request</h2>
        <p className="mt-2 text-sm text-slate-600">Enter the email address for another Buddies owner account.</p>
        <form action="/api/buddies/request" method="post" className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input name="email" type="email" required placeholder="owner@example.com" className="rounded-lg border px-3 py-3 text-base" />
          <input name="note" placeholder="Optional note" maxLength={240} className="rounded-lg border px-3 py-3 text-base" />
          <button className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Send request</button>
        </form>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Buddies</p><p className="mt-2 text-3xl font-bold">{buddies.length}</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Incoming</p><p className="mt-2 text-3xl font-bold">{incoming.length}</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Sent</p><p className="mt-2 text-3xl font-bold">{outgoing.length}</p></article>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Incoming requests</h2>
          <div className="mt-4 grid gap-3">
            {incoming.length === 0 ? <p className="text-sm text-slate-600">No pending incoming requests.</p> : incoming.map((request) => (
              <article key={request.id} className="rounded-xl border p-4">
                <h3 className="font-semibold">{request.sender.displayName}</h3>
                <p className="text-sm text-slate-600">{request.sender.email}</p>
                {request.message ? <p className="mt-2 text-sm text-slate-700">{request.message}</p> : null}
                <div className="mt-3 flex gap-2">
                  <form action="/api/buddies/respond" method="post"><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="action" value="accept" /><button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Accept</button></form>
                  <form action="/api/buddies/respond" method="post"><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="action" value="decline" /><button className="rounded-lg border px-4 py-2 text-sm font-medium">Decline</button></form>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Sent requests</h2>
          <div className="mt-4 grid gap-3">
            {outgoing.length === 0 ? <p className="text-sm text-slate-600">No sent requests pending.</p> : outgoing.map((request) => (
              <article key={request.id} className="rounded-xl border p-4">
                <h3 className="font-semibold">{request.receiver.displayName}</h3>
                <p className="text-sm text-slate-600">{request.receiver.email}</p>
                {request.message ? <p className="mt-2 text-sm text-slate-700">{request.message}</p> : null}
                <form action="/api/buddies/respond" method="post" className="mt-3"><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="action" value="cancel" /><button className="rounded-lg border px-4 py-2 text-sm font-medium">Cancel request</button></form>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Current buddies</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {buddies.length === 0 ? <p className="text-sm text-slate-600">No buddies yet. Send your first request above.</p> : buddies.map(({ id, owner }) => (
            <article key={id} className="rounded-xl border p-4">
              <h3 className="font-semibold">{owner.displayName}</h3>
              <p className="text-sm text-slate-600">{owner.email}</p>
              <div className="mt-3 text-sm text-slate-700">
                {owner.dogs.length ? owner.dogs.map((dog) => <Link key={dog.id} href={`/dogs/${dog.slug}`} className="mr-2 underline">{dog.name}</Link>) : 'No public dogs listed'}
              </div>
              <form action="/api/buddies/remove" method="post" className="mt-4"><input type="hidden" name="buddyId" value={id} /><button className="rounded-lg border px-4 py-2 text-sm font-medium">Remove buddy</button></form>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
