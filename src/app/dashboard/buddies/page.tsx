import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

type OwnerCard = { id: string; displayName: string; email: string; city: string | null; dogs: { id: string; name: string; slug: string }[] };

type SearchParams = { sent?: string; accepted?: string; declined?: string; cancelled?: string; removed?: string; error?: string; q?: string };

function statusMessage(searchParams: SearchParams) {
  if (searchParams.sent) return 'Buddy request sent.';
  if (searchParams.accepted) return 'Buddy request accepted.';
  if (searchParams.declined) return 'Buddy request declined.';
  if (searchParams.cancelled) return 'Buddy request cancelled.';
  if (searchParams.removed) return 'Buddy removed.';
  if (searchParams.error === 'not-found') return 'No owner account exists for that email.';
  if (searchParams.error === 'exists') return 'That owner is already your trusted buddy.';
  if (searchParams.error === 'invalid') return 'Enter another owner email address.';
  if (searchParams.error) return 'Unable to complete that owner-network action.';
  return null;
}

function mutualCount(ownerId: string, myBuddyIds: Set<string>, allBuddyPairs: { userAId: string; userBId: string }[]) {
  const theirBuddies = new Set<string>();
  for (const pair of allBuddyPairs) {
    if (pair.userAId === ownerId) theirBuddies.add(pair.userBId);
    if (pair.userBId === ownerId) theirBuddies.add(pair.userAId);
  }
  let count = 0;
  theirBuddies.forEach((id) => { if (myBuddyIds.has(id)) count += 1; });
  return count;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">{title}</h2><div className="mt-4">{children}</div></section>;
}

export default async function BuddiesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const params = await searchParams;
  const message = statusMessage(params);
  const query = String(params.q ?? '').trim();

  const [incoming, outgoing, buddyLinks, allUsers, dogs, walkInvites, allBuddyPairs] = await Promise.all([
    prisma.buddyRequest.findMany({ where: { receiverId: user.id, status: 'PENDING' }, orderBy: { createdAt: 'desc' }, include: { sender: { select: { id: true, displayName: true, email: true, city: true, dogs: { select: { id: true, name: true, slug: true }, take: 3 } } } } }),
    prisma.buddyRequest.findMany({ where: { senderId: user.id, status: 'PENDING' }, orderBy: { createdAt: 'desc' }, include: { receiver: { select: { id: true, displayName: true, email: true, city: true, dogs: { select: { id: true, name: true, slug: true }, take: 3 } } } } }),
    prisma.buddy.findMany({ where: { OR: [{ userAId: user.id }, { userBId: user.id }] }, orderBy: { createdAt: 'desc' }, include: { userA: { select: { id: true, displayName: true, email: true, city: true, dogs: { select: { id: true, name: true, slug: true }, take: 3 } } }, userB: { select: { id: true, displayName: true, email: true, city: true, dogs: { select: { id: true, name: true, slug: true }, take: 3 } } } } }),
    prisma.user.findMany({ where: { id: { not: user.id }, ...(query ? { OR: [{ email: { contains: query, mode: 'insensitive' as const } }, { displayName: { contains: query, mode: 'insensitive' as const } }, { city: { contains: query, mode: 'insensitive' as const } }] } : {}) }, orderBy: [{ city: 'asc' }, { displayName: 'asc' }], take: 24, select: { id: true, displayName: true, email: true, city: true, dogs: { select: { id: true, name: true, slug: true }, take: 3 } } }),
    prisma.dog.findMany({ where: { ownerId: user.id }, select: { id: true, name: true }, orderBy: { createdAt: 'desc' } }),
    prisma.walk.findMany({ where: { OR: [{ requesterId: user.id }, { walkerId: user.id }], status: { in: ['REQUESTED', 'ACCEPTED'] } }, orderBy: { startsAt: 'asc' }, take: 8, include: { dog: { select: { name: true } }, requester: { select: { id: true, displayName: true, email: true } }, walker: { select: { id: true, displayName: true, email: true } } } }),
    prisma.buddy.findMany({ select: { userAId: true, userBId: true } })
  ]);

  const buddies = buddyLinks.map((link) => ({ id: link.id, owner: link.userAId === user.id ? link.userB : link.userA }));
  const buddyIds = new Set(buddies.map((b) => b.owner.id));
  const requestIds = new Set([...incoming.map((r) => r.senderId), ...outgoing.map((r) => r.receiverId)]);
  const suggested = (allUsers as OwnerCard[]).filter((owner) => !buddyIds.has(owner.id) && !requestIds.has(owner.id)).slice(0, 8);
  const inviteLink = `https://buddies.vercel.app/dashboard/buddies?inviteFrom=${user.id}`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Buddies V2.3 Owner Social Graph</p>
          <h1 className="text-3xl font-bold">Buddies</h1>
          <p className="mt-2 text-slate-600">Owner-to-owner network: requests, trusted owners, walk invites, search, groups, QR invites, and link invites.</p>
        </div>
        <div className="flex flex-wrap gap-2"><Link href="/dashboard" className="rounded-lg border px-4 py-2">Dashboard</Link><Link href="/dashboard/buddies/invite" className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white">Invite QR</Link></div>
      </div>

      {message ? <div className="mt-6 rounded-xl border bg-white p-4 text-sm text-slate-700 shadow-sm">{message}</div> : null}

      <section className="mt-8 grid gap-4 sm:grid-cols-4"><article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Trusted owners</p><p className="mt-2 text-3xl font-bold">{buddies.length}</p></article><article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Friend requests</p><p className="mt-2 text-3xl font-bold">{incoming.length}</p></article><article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Sent</p><p className="mt-2 text-3xl font-bold">{outgoing.length}</p></article><article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Walk invites</p><p className="mt-2 text-3xl font-bold">{walkInvites.length}</p></article></section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <Section title="Owner search"><form action="/dashboard/buddies" method="get" className="grid gap-3"><input name="q" defaultValue={query} placeholder="Search by owner name, email, or city" className="rounded-lg border px-3 py-3 text-base" /><button className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Search owners</button></form></Section>
        <Section title="Invite via link"><p className="break-all text-sm text-slate-600">{inviteLink}</p><div className="mt-3 flex flex-wrap gap-2"><Link href="/dashboard/buddies/invite" className="rounded-lg border px-4 py-2">Open invite QR</Link><a href={`sms:?&body=${encodeURIComponent(`Join me on Buddies: ${inviteLink}`)}`} className="rounded-lg border px-4 py-2">Send link</a></div></Section>
      </section>

      <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">Friend requests</h2><div className="mt-4 grid gap-6 lg:grid-cols-2"><div><h3 className="font-semibold">Incoming</h3><div className="mt-3 grid gap-3">{incoming.length === 0 ? <p className="text-sm text-slate-600">No pending incoming requests.</p> : incoming.map((request) => <article key={request.id} className="rounded-xl border p-4"><h4 className="font-semibold">{request.sender.displayName}</h4><p className="text-sm text-slate-600">{request.sender.email}</p>{request.message ? <p className="mt-2 text-sm text-slate-700">{request.message}</p> : null}<div className="mt-3 flex gap-2"><form action="/api/buddies/respond" method="post"><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="action" value="accept" /><button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Accept</button></form><form action="/api/buddies/respond" method="post"><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="action" value="decline" /><button className="rounded-lg border px-4 py-2 text-sm font-medium">Decline</button></form></div></article>)}</div></div><div><h3 className="font-semibold">Sent</h3><div className="mt-3 grid gap-3">{outgoing.length === 0 ? <p className="text-sm text-slate-600">No sent requests pending.</p> : outgoing.map((request) => <article key={request.id} className="rounded-xl border p-4"><h4 className="font-semibold">{request.receiver.displayName}</h4><p className="text-sm text-slate-600">{request.receiver.email}</p><form action="/api/buddies/respond" method="post" className="mt-3"><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="action" value="cancel" /><button className="rounded-lg border px-4 py-2 text-sm font-medium">Cancel request</button></form></article>)}</div></div></div></section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <Section title="Suggested owners nearby"><div className="grid gap-3">{suggested.length === 0 ? <p className="text-sm text-slate-600">No suggestions yet. Use owner search to find another account.</p> : suggested.map((owner) => <article key={owner.id} className="rounded-xl border p-4"><h3 className="font-semibold">{owner.displayName}</h3><p className="text-sm text-slate-600">{owner.city ?? 'Location not set'} · {owner.email}</p><p className="mt-1 text-xs text-slate-500">Mutual friends: {mutualCount(owner.id, buddyIds, allBuddyPairs)}</p><form action="/api/buddies/request" method="post" className="mt-3 flex gap-2"><input type="hidden" name="email" value={owner.email} /><input name="note" placeholder="Optional note" className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm" /><button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white">Add</button></form></article>)}</div></Section>
        <Section title="Trusted owners"><div className="grid gap-3">{buddies.length === 0 ? <p className="text-sm text-slate-600">No trusted owners yet.</p> : buddies.map(({ id, owner }) => <article key={id} className="rounded-xl border p-4"><h3 className="font-semibold">{owner.displayName}</h3><p className="text-sm text-slate-600">{owner.email}</p><p className="mt-1 text-xs text-slate-500">Mutual friends: {mutualCount(owner.id, buddyIds, allBuddyPairs)}</p><div className="mt-2 text-sm text-slate-700">{owner.dogs.length ? owner.dogs.map((dog) => <Link key={dog.id} href={`/dogs/${dog.slug}`} className="mr-2 underline">{dog.name}</Link>) : 'No public profiles listed'}</div><form action="/api/buddies/remove" method="post" className="mt-3"><input type="hidden" name="buddyId" value={id} /><button className="rounded-lg border px-4 py-2 text-sm font-medium">Remove</button></form></article>)}</div></Section>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <Section title="Walking groups"><div className="grid gap-3"><form action="/api/buddies/group" method="post" className="grid gap-3"><input name="name" placeholder="Group name" className="rounded-lg border px-3 py-3 text-base" /><input name="description" placeholder="Neighborhood, schedule, or purpose" className="rounded-lg border px-3 py-3 text-base" /><button className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Create walking group</button></form><p className="text-sm text-slate-600">Groups are persisted as owner-led walking circles in this milestone.</p></div></Section>
        <Section title="Shared walk invitations"><form action="/api/buddies/walk-invite" method="post" className="grid gap-3"><select name="dogId" className="rounded-lg border px-3 py-3 text-base">{dogs.map((dog) => <option key={dog.id} value={dog.id}>{dog.name}</option>)}</select><input name="email" type="email" placeholder="Trusted owner email" className="rounded-lg border px-3 py-3 text-base" /><input name="startsAt" type="datetime-local" className="rounded-lg border px-3 py-3 text-base" /><input name="note" placeholder="Optional walk note" className="rounded-lg border px-3 py-3 text-base" /><button className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Send walk invite</button></form><div className="mt-4 grid gap-2">{walkInvites.length === 0 ? <p className="text-sm text-slate-600">No active walk invitations.</p> : walkInvites.map((walk) => <article key={walk.id} className="rounded-lg border p-3 text-sm"><p className="font-medium">{walk.dog.name} · {walk.startsAt.toLocaleString()}</p><p className="text-slate-600">Requester: {walk.requester.displayName}{walk.walker ? ` · Walker: ${walk.walker.displayName}` : ' · Walker pending'}</p></article>)}</div></Section>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2"><Section title="Mutual friends"><p className="text-sm text-slate-600">Mutual friend counts now appear on suggested owners and trusted owner cards.</p></Section><Section title="Blocked users"><form action="/api/buddies/block" method="post" className="grid gap-3"><input name="email" type="email" placeholder="owner@example.com" className="rounded-lg border px-3 py-3 text-base" /><input name="reason" placeholder="Optional reason" className="rounded-lg border px-3 py-3 text-base" /><button className="rounded-lg border px-5 py-3 font-medium">Block owner</button></form></Section></section>
    </main>
  );
}
