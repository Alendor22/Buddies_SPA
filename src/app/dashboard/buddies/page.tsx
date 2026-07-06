import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

type DogCard = { id: string; name: string; slug: string; breed: string | null; status: string; photoUrl: string | null; owner: { id: string; displayName: string; email: string; city: string | null } };
type SearchParams = { sent?: string; accepted?: string; declined?: string; cancelled?: string; removed?: string; error?: string; q?: string };

function statusMessage(searchParams: SearchParams) {
  if (searchParams.sent) return 'Buddy request sent.';
  if (searchParams.accepted) return 'Buddy request accepted.';
  if (searchParams.declined) return 'Buddy request declined.';
  if (searchParams.cancelled) return 'Buddy request cancelled.';
  if (searchParams.removed) return 'Buddy removed.';
  if (searchParams.error === 'not-found') return 'No matching profile was found.';
  if (searchParams.error === 'exists') return 'That profile is already in your buddy network.';
  if (searchParams.error === 'invalid') return 'Choose another dog profile.';
  if (searchParams.error) return 'Unable to complete that dog-network action.';
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

function DogAvatar({ dog }: { dog: Pick<DogCard, 'name' | 'photoUrl'> }) {
  if (dog.photoUrl) return <img src={dog.photoUrl} alt={`${dog.name} avatar`} className="h-14 w-14 rounded-full object-cover" />;
  return <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-2xl text-white">🐶</div>;
}

function DogIdentity({ dog, sub }: { dog: DogCard; sub?: string }) {
  return (
    <div className="flex gap-3">
      <DogAvatar dog={dog} />
      <div className="min-w-0">
        <h3 className="font-semibold">{dog.name}</h3>
        <p className="text-sm text-slate-600">{dog.breed ?? 'Breed not listed'} · {dog.status}</p>
        <p className="text-xs text-slate-500">Owner hidden · {dog.owner.city ?? 'Location not set'}</p>
        {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
      </div>
    </div>
  );
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

  const [incoming, outgoing, buddyLinks, suggestedDogs, myDogs, walkInvites, allBuddyPairs] = await Promise.all([
    prisma.buddyRequest.findMany({ where: { receiverId: user.id, status: 'PENDING' }, orderBy: { createdAt: 'desc' }, include: { sender: { select: { id: true, displayName: true, email: true, city: true, dogs: { select: { id: true, name: true, slug: true, breed: true, status: true, photoUrl: true }, take: 1 } } } } }),
    prisma.buddyRequest.findMany({ where: { senderId: user.id, status: 'PENDING' }, orderBy: { createdAt: 'desc' }, include: { receiver: { select: { id: true, displayName: true, email: true, city: true, dogs: { select: { id: true, name: true, slug: true, breed: true, status: true, photoUrl: true }, take: 1 } } } } }),
    prisma.buddy.findMany({ where: { OR: [{ userAId: user.id }, { userBId: user.id }] }, orderBy: { createdAt: 'desc' }, include: { userA: { select: { id: true, displayName: true, email: true, city: true, dogs: { select: { id: true, name: true, slug: true, breed: true, status: true, photoUrl: true }, take: 1 } } }, userB: { select: { id: true, displayName: true, email: true, city: true, dogs: { select: { id: true, name: true, slug: true, breed: true, status: true, photoUrl: true }, take: 1 } } } } }),
    prisma.dog.findMany({ where: { ownerId: { not: user.id }, ...(query ? { OR: [{ name: { contains: query, mode: 'insensitive' as const } }, { breed: { contains: query, mode: 'insensitive' as const } }, { owner: { displayName: { contains: query, mode: 'insensitive' as const } } }, { owner: { city: { contains: query, mode: 'insensitive' as const } } }] } : {}) }, orderBy: { createdAt: 'desc' }, take: 24, select: { id: true, name: true, slug: true, breed: true, status: true, photoUrl: true, owner: { select: { id: true, displayName: true, email: true, city: true } } } }),
    prisma.dog.findMany({ where: { ownerId: user.id }, select: { id: true, name: true }, orderBy: { createdAt: 'desc' } }),
    prisma.walk.findMany({ where: { OR: [{ requesterId: user.id }, { walkerId: user.id }], status: { in: ['REQUESTED', 'ACCEPTED'] } }, orderBy: { startsAt: 'asc' }, take: 8, include: { dog: { select: { name: true } }, requester: { select: { id: true, displayName: true } }, walker: { select: { id: true, displayName: true } } } }),
    prisma.buddy.findMany({ select: { userAId: true, userBId: true } })
  ]);

  const buddies = buddyLinks.map((link) => ({ id: link.id, owner: link.userAId === user.id ? link.userB : link.userA }));
  const buddyIds = new Set(buddies.map((b) => b.owner.id));
  const requestIds = new Set([...incoming.map((r) => r.senderId), ...outgoing.map((r) => r.receiverId)]);
  const suggested = (suggestedDogs as DogCard[]).filter((dog) => !buddyIds.has(dog.owner.id) && !requestIds.has(dog.owner.id)).slice(0, 8);
  const inviteLink = `https://buddies.vercel.app/dashboard/buddies?inviteFrom=${user.id}`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Buddies V2.3 Dog-to-Dog Social Graph</p>
          <h1 className="text-3xl font-bold">Buddies</h1>
          <p className="mt-2 text-slate-600">Dog profiles interact first. Owner contact details stay hidden until trust is established.</p>
        </div>
        <div className="flex flex-wrap gap-2"><Link href="/dashboard" className="rounded-lg border px-4 py-2">Dashboard</Link><Link href="/dashboard/buddies/invite" className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white">Invite QR</Link></div>
      </div>

      {message ? <div className="mt-6 rounded-xl border bg-white p-4 text-sm text-slate-700 shadow-sm">{message}</div> : null}

      <section className="mt-8 grid gap-4 sm:grid-cols-4"><article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Trusted dogs</p><p className="mt-2 text-3xl font-bold">{buddies.length}</p></article><article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Buddy requests</p><p className="mt-2 text-3xl font-bold">{incoming.length}</p></article><article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Sent</p><p className="mt-2 text-3xl font-bold">{outgoing.length}</p></article><article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Walk invites</p><p className="mt-2 text-3xl font-bold">{walkInvites.length}</p></article></section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <Section title="Dog search"><form action="/dashboard/buddies" method="get" className="grid gap-3"><input name="q" defaultValue={query} placeholder="Search by dog name, breed, owner name, or city" className="rounded-lg border px-3 py-3 text-base" /><button className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Search dogs</button></form></Section>
        <Section title="Invite via link"><p className="break-all text-sm text-slate-600">{inviteLink}</p><div className="mt-3 flex flex-wrap gap-2"><Link href="/dashboard/buddies/invite" className="rounded-lg border px-4 py-2">Open invite QR</Link><a href={`sms:?&body=${encodeURIComponent(`Join my dog network on Buddies: ${inviteLink}`)}`} className="rounded-lg border px-4 py-2">Send link</a></div></Section>
      </section>

      <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">Buddy requests</h2><div className="mt-4 grid gap-6 lg:grid-cols-2"><div><h3 className="font-semibold">Incoming dog requests</h3><div className="mt-3 grid gap-3">{incoming.length === 0 ? <p className="text-sm text-slate-600">No pending incoming requests.</p> : incoming.map((request) => { const dog = request.sender.dogs[0]; return <article key={request.id} className="rounded-xl border p-4"><div className="flex gap-3"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-2xl text-white">🐶</div><div><h4 className="font-semibold">{dog?.name ?? 'Dog profile'}</h4><p className="text-sm text-slate-600">{dog?.breed ?? 'Breed hidden'} · Owner hidden</p></div></div>{request.message ? <p className="mt-2 text-sm text-slate-700">{request.message}</p> : null}<div className="mt-3 flex gap-2"><form action="/api/buddies/respond" method="post"><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="action" value="accept" /><button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Accept</button></form><form action="/api/buddies/respond" method="post"><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="action" value="decline" /><button className="rounded-lg border px-4 py-2 text-sm font-medium">Decline</button></form></div></article>; })}</div></div><div><h3 className="font-semibold">Sent dog requests</h3><div className="mt-3 grid gap-3">{outgoing.length === 0 ? <p className="text-sm text-slate-600">No sent requests pending.</p> : outgoing.map((request) => { const dog = request.receiver.dogs[0]; return <article key={request.id} className="rounded-xl border p-4"><div className="flex gap-3"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-2xl text-white">🐶</div><div><h4 className="font-semibold">{dog?.name ?? 'Dog profile'}</h4><p className="text-sm text-slate-600">{dog?.breed ?? 'Breed hidden'} · Owner hidden</p></div></div><form action="/api/buddies/respond" method="post" className="mt-3"><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="action" value="cancel" /><button className="rounded-lg border px-4 py-2 text-sm font-medium">Cancel request</button></form></article>; })}</div></div></div></section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <Section title="Suggested dogs nearby"><div className="grid gap-3">{suggested.length === 0 ? <p className="text-sm text-slate-600">No dog suggestions yet. Use search to find a profile.</p> : suggested.map((dog) => <article key={dog.id} className="rounded-xl border p-4"><DogIdentity dog={dog} sub={`Mutual buddies: ${mutualCount(dog.owner.id, buddyIds, allBuddyPairs)}`} /><form action="/api/buddies/request" method="post" className="mt-3 flex gap-2"><input type="hidden" name="email" value={dog.owner.email} /><input name="note" placeholder="Optional dog-to-dog note" className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm" /><button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white">Add</button></form></article>)}</div></Section>
        <Section title="Trusted dog network"><div className="grid gap-3">{buddies.length === 0 ? <p className="text-sm text-slate-600">No trusted dog connections yet.</p> : buddies.map(({ id, owner }) => { const dog = owner.dogs[0]; return <article key={id} className="rounded-xl border p-4"><div className="flex gap-3"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-2xl text-white">🐶</div><div><h3 className="font-semibold">{dog?.name ?? 'Trusted dog'}</h3><p className="text-sm text-slate-600">{dog?.breed ?? 'Breed not listed'} · Owner hidden</p><p className="mt-1 text-xs text-slate-500">Mutual buddies: {mutualCount(owner.id, buddyIds, allBuddyPairs)}</p></div></div>{dog ? <Link href={`/dogs/${dog.slug}`} className="mt-3 inline-block rounded-lg border px-4 py-2 text-sm">View dog profile</Link> : null}<form action="/api/buddies/remove" method="post" className="mt-3"><input type="hidden" name="buddyId" value={id} /><button className="rounded-lg border px-4 py-2 text-sm font-medium">Remove</button></form></article>; })}</div></Section>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <Section title="Walking groups"><div className="grid gap-3"><form action="/api/buddies/group" method="post" className="grid gap-3"><input name="name" placeholder="Group name" className="rounded-lg border px-3 py-3 text-base" /><input name="description" placeholder="Neighborhood, schedule, or purpose" className="rounded-lg border px-3 py-3 text-base" /><button className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Create walking group</button></form><p className="text-sm text-slate-600">Groups are dog-pack circles. Owner details remain private by default.</p></div></Section>
        <Section title="Shared walk invitations"><form action="/api/buddies/walk-invite" method="post" className="grid gap-3"><select name="dogId" className="rounded-lg border px-3 py-3 text-base">{myDogs.map((dog) => <option key={dog.id} value={dog.id}>{dog.name}</option>)}</select><input name="email" type="email" placeholder="Trusted owner email for now" className="rounded-lg border px-3 py-3 text-base" /><input name="startsAt" type="datetime-local" className="rounded-lg border px-3 py-3 text-base" /><input name="note" placeholder="Optional walk note" className="rounded-lg border px-3 py-3 text-base" /><button className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Send walk invite</button></form><div className="mt-4 grid gap-2">{walkInvites.length === 0 ? <p className="text-sm text-slate-600">No active walk invitations.</p> : walkInvites.map((walk) => <article key={walk.id} className="rounded-lg border p-3 text-sm"><p className="font-medium">{walk.dog.name} · {walk.startsAt.toLocaleString()}</p><p className="text-slate-600">Dog-to-dog walk invite · owner details hidden</p></article>)}</div></Section>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2"><Section title="Mutual buddies"><p className="text-sm text-slate-600">Mutual buddy counts now use the owner relationship graph but display as dog-to-dog context.</p></Section><Section title="Blocked profiles"><form action="/api/buddies/block" method="post" className="grid gap-3"><input name="email" type="email" placeholder="Hidden owner email until dog-id blocking is added" className="rounded-lg border px-3 py-3 text-base" /><input name="reason" placeholder="Optional reason" className="rounded-lg border px-3 py-3 text-base" /><button className="rounded-lg border px-5 py-3 font-medium">Block profile</button></form></Section></section>
    </main>
  );
}
