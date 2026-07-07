import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { UI_ROUTES } from '@/lib/uiRoutes';

export const dynamic = 'force-dynamic';

type DogCard = {
  id: string;
  name: string;
  slug: string;
  breed: string | null;
  status: string;
  photoUrl: string | null;
  owner: { id: string; displayName: string; email: string; city: string | null };
};

type SearchParams = {
  sent?: string;
  accepted?: string;
  declined?: string;
  cancelled?: string;
  removed?: string;
  error?: string;
  q?: string;
  walk?: string;
  dog?: string;
  invited?: string;
};

function statusMessage(searchParams: SearchParams) {
  if (searchParams.walk === 'sent') return `${searchParams.dog ?? 'Your dog'} invited ${searchParams.invited ?? 'a trusted dog'} to a walk.`;
  if (searchParams.sent) return 'Buddy request sent.';
  if (searchParams.accepted) return 'Buddy request accepted.';
  if (searchParams.declined) return 'Buddy request declined.';
  if (searchParams.cancelled) return 'Buddy request cancelled.';
  if (searchParams.removed) return 'Buddy removed.';
  if (searchParams.error === 'not-found') return 'No matching profile was found.';
  if (searchParams.error === 'exists') return 'That profile is not available for this action.';
  if (searchParams.error === 'walk-invalid') return 'Choose one of your dogs, a trusted invited dog, and a valid walk time.';
  if (searchParams.error === 'invalid') return 'Choose another dog profile.';
  if (searchParams.error) return 'Unable to complete that dog-network action.';
  return null;
}

function mutualCount(ownerId: string, myBuddyIds: Set<string>, pairs: { userAId: string; userBId: string }[]) {
  const theirBuddies = new Set<string>();
  for (const pair of pairs) {
    if (pair.userAId === ownerId) theirBuddies.add(pair.userBId);
    if (pair.userBId === ownerId) theirBuddies.add(pair.userAId);
  }
  let count = 0;
  theirBuddies.forEach((id) => { if (myBuddyIds.has(id)) count += 1; });
  return count;
}

function DogAvatar({ dog }: { dog: { name: string; photoUrl: string | null } }) {
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

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return <section id={id} className="scroll-mt-24 rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">{title}</h2><div className="mt-4">{children}</div></section>;
}

export default async function BuddiesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const params = await searchParams;
  const message = statusMessage(params);
  const query = String(params.q ?? '').trim();

  const [incoming, outgoing, buddyLinks, suggestedDogs, myDogs, invitations, allBuddyPairs] = await Promise.all([
    prisma.buddyRequest.findMany({
      where: { receiverId: user.id, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: { sender: { select: { id: true, displayName: true, email: true, city: true, dogs: { select: { id: true, name: true, slug: true, breed: true, status: true, photoUrl: true }, take: 1 } } } }
    }),
    prisma.buddyRequest.findMany({
      where: { senderId: user.id, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: { receiver: { select: { id: true, displayName: true, email: true, city: true, dogs: { select: { id: true, name: true, slug: true, breed: true, status: true, photoUrl: true }, take: 1 } } } }
    }),
    prisma.buddy.findMany({
      where: { OR: [{ userAId: user.id }, { userBId: user.id }] },
      orderBy: { createdAt: 'desc' },
      include: {
        userA: { select: { id: true, displayName: true, email: true, city: true, dogs: { select: { id: true, name: true, slug: true, breed: true, status: true, photoUrl: true } } } },
        userB: { select: { id: true, displayName: true, email: true, city: true, dogs: { select: { id: true, name: true, slug: true, breed: true, status: true, photoUrl: true } } } }
      }
    }),
    prisma.dog.findMany({
      where: {
        ownerId: { not: user.id },
        ...(query ? { OR: [{ name: { contains: query, mode: 'insensitive' as const } }, { breed: { contains: query, mode: 'insensitive' as const } }, { owner: { displayName: { contains: query, mode: 'insensitive' as const } } }, { owner: { city: { contains: query, mode: 'insensitive' as const } } }] } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 24,
      select: { id: true, name: true, slug: true, breed: true, status: true, photoUrl: true, owner: { select: { id: true, displayName: true, email: true, city: true } } }
    }),
    prisma.dog.findMany({ where: { ownerId: user.id }, select: { id: true, name: true, slug: true }, orderBy: { createdAt: 'desc' } }),
    prisma.walkInvitation.findMany({
      where: { OR: [{ senderDog: { ownerId: user.id } }, { invitedDog: { ownerId: user.id } }] },
      orderBy: { createdAt: 'desc' },
      take: 24,
      include: {
        senderDog: { select: { id: true, name: true, slug: true, breed: true, photoUrl: true, ownerId: true } },
        invitedDog: { select: { id: true, name: true, slug: true, breed: true, photoUrl: true, ownerId: true } },
        walk: { select: { id: true, startsAt: true, durationMin: true, status: true } }
      }
    }),
    prisma.buddy.findMany({ select: { userAId: true, userBId: true } })
  ]);

  const buddies = buddyLinks.map((link) => ({ id: link.id, owner: link.userAId === user.id ? link.userB : link.userA }));
  const buddyIds = new Set(buddies.map((buddy) => buddy.owner.id));
  const requestIds = new Set([...incoming.map((request) => request.senderId), ...outgoing.map((request) => request.receiverId)]);
  const suggested = (suggestedDogs as DogCard[]).filter((dog) => !buddyIds.has(dog.owner.id) && !requestIds.has(dog.owner.id)).slice(0, 8);
  const trustedDogs = buddies.flatMap((buddy) => buddy.owner.dogs);
  const incomingInvites = invitations.filter((invite) => invite.invitedDog.ownerId === user.id);
  const sentInvites = invitations.filter((invite) => invite.senderDog.ownerId === user.id);
  const inviteLink = `https://buddies.vercel.app/dashboard/buddies?inviteFrom=${user.id}`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Buddies Phase 1 Dog-to-Dog Social Graph</p>
          <h1 className="text-3xl font-bold">Buddies</h1>
          <p className="mt-2 text-slate-600">Dog profiles interact first. Walk invitations now connect a specific sender dog to a specific invited dog.</p>
        </div>
        <div className="flex flex-wrap gap-2"><Link href={UI_ROUTES.dashboard} className="rounded-lg border px-4 py-2">Dashboard</Link><Link href="/dashboard/buddies/invite" className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white">Invite QR</Link></div>
      </div>

      {message ? <div className="mt-6 rounded-xl border bg-white p-4 text-sm text-slate-700 shadow-sm">{message}</div> : null}

      <section className="mt-8 grid gap-4 sm:grid-cols-4">
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Trusted dogs</p><p className="mt-2 text-3xl font-bold">{trustedDogs.length}</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Buddy requests</p><p className="mt-2 text-3xl font-bold">{incoming.length}</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Invites received</p><p className="mt-2 text-3xl font-bold">{incomingInvites.length}</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Invites sent</p><p className="mt-2 text-3xl font-bold">{sentInvites.length}</p></article>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <Section title="Dog search"><form action={UI_ROUTES.buddies} method="get" className="grid gap-3"><input name="q" defaultValue={query} placeholder="Search by dog name, breed, owner name, or city" className="rounded-lg border px-3 py-3 text-base" /><button className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Search dogs</button></form></Section>
        <Section title="Invite via link"><p className="break-all text-sm text-slate-600">{inviteLink}</p><div className="mt-3 flex flex-wrap gap-2"><Link href="/dashboard/buddies/invite" className="rounded-lg border px-4 py-2">Open invite QR</Link><a href={`sms:?&body=${encodeURIComponent(`Join my dog network on Buddies: ${inviteLink}`)}`} className="rounded-lg border px-4 py-2">Send link</a></div></Section>
      </section>

      <div className="mt-8">
        <Section id="buddy-requests" title="Buddy requests">
          <div className="grid gap-6 lg:grid-cols-2">
            <div><h3 className="font-semibold">Incoming dog requests</h3><div className="mt-3 grid gap-3">{incoming.length === 0 ? <p className="text-sm text-slate-600">No pending incoming requests.</p> : incoming.map((request) => { const dog = request.sender.dogs[0]; return <article key={request.id} className="rounded-xl border p-4"><div className="flex gap-3"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-2xl text-white">🐶</div><div><h4 className="font-semibold">{dog?.name ?? 'Dog profile'}</h4><p className="text-sm text-slate-600">{dog?.breed ?? 'Breed hidden'} · Owner hidden</p></div></div>{request.message ? <p className="mt-2 text-sm text-slate-700">{request.message}</p> : null}<div className="mt-3 flex gap-2"><form action="/api/buddies/respond" method="post"><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="action" value="accept" /><button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Accept</button></form><form action="/api/buddies/respond" method="post"><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="action" value="decline" /><button className="rounded-lg border px-4 py-2 text-sm font-medium">Decline</button></form></div></article>; })}</div></div>
            <div><h3 className="font-semibold">Sent dog requests</h3><div className="mt-3 grid gap-3">{outgoing.length === 0 ? <p className="text-sm text-slate-600">No sent requests pending.</p> : outgoing.map((request) => { const dog = request.receiver.dogs[0]; return <article key={request.id} className="rounded-xl border p-4"><div className="flex gap-3"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-2xl text-white">🐶</div><div><h4 className="font-semibold">{dog?.name ?? 'Dog profile'}</h4><p className="text-sm text-slate-600">{dog?.breed ?? 'Breed hidden'} · Owner hidden</p></div></div><form action="/api/buddies/respond" method="post" className="mt-3"><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="action" value="cancel" /><button className="rounded-lg border px-4 py-2 text-sm font-medium">Cancel request</button></form></article>; })}</div></div>
          </div>
        </Section>
      </div>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <Section title="Suggested dogs nearby"><div className="grid gap-3">{suggested.length === 0 ? <p className="text-sm text-slate-600">No dog suggestions yet. Use search to find a profile.</p> : suggested.map((dog) => <article key={dog.id} className="rounded-xl border p-4"><DogIdentity dog={dog} sub={`Mutual buddies: ${mutualCount(dog.owner.id, buddyIds, allBuddyPairs)}`} /><form action="/api/buddies/request" method="post" className="mt-3 flex gap-2"><input type="hidden" name="email" value={dog.owner.email} /><input name="note" placeholder="Optional dog-to-dog note" className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm" /><button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white">Add</button></form></article>)}</div></Section>
        <Section title="Trusted dog network"><div className="grid gap-3">{trustedDogs.length === 0 ? <p className="text-sm text-slate-600">No trusted dog connections yet.</p> : trustedDogs.map((dog) => <article key={dog.id} className="rounded-xl border p-4"><div className="flex gap-3"><DogAvatar dog={dog} /><div><h3 className="font-semibold">{dog.name}</h3><p className="text-sm text-slate-600">{dog.breed ?? 'Breed not listed'} · Owner hidden</p></div></div><Link href={`/dogs/${dog.slug}`} className="mt-3 inline-block rounded-lg border px-4 py-2 text-sm">View dog profile</Link></article>)}</div></Section>
      </section>

      <section id="walk-invitations" className="mt-8 scroll-mt-24 grid gap-6 lg:grid-cols-2">
        <Section title="Send walk invitation">
          <form action="/api/buddies/walk-invite" method="post" className="grid gap-3">
            <label className="grid gap-2 text-sm font-medium">Your dog<select name="dogId" required className="rounded-lg border px-3 py-3 text-base">{myDogs.map((dog) => <option key={dog.id} value={dog.id}>{dog.name}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-medium">Invite trusted dog<select name="invitedDogId" required className="rounded-lg border px-3 py-3 text-base"><option value="">Select dog</option>{trustedDogs.map((dog) => <option key={dog.id} value={dog.id}>{dog.name}{dog.breed ? ` · ${dog.breed}` : ''}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-medium">Starts at<input name="startsAt" type="datetime-local" required className="rounded-lg border px-3 py-3 text-base" /></label>
            <label className="grid gap-2 text-sm font-medium">Note<input name="note" placeholder="Optional walk note" className="rounded-lg border px-3 py-3 text-base" /></label>
            <button disabled={!myDogs.length || !trustedDogs.length} className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">Send dog-to-dog invite</button>
          </form>
          {!trustedDogs.length ? <p className="mt-3 text-sm text-slate-600">Accept a buddy connection before sending dog-specific walk invitations.</p> : null}
        </Section>

        <Section title="Walk invitation activity">
          <div className="grid gap-5">
            <div><h3 className="font-semibold">Received</h3><div className="mt-2 grid gap-2">{incomingInvites.length === 0 ? <p className="text-sm text-slate-600">No invitations received.</p> : incomingInvites.map((invite) => <article key={invite.id} className="rounded-xl border p-4"><p className="font-semibold">{invite.senderDog.name} invited {invite.invitedDog.name}</p><p className="mt-1 text-sm text-slate-600">{invite.walk.startsAt.toLocaleString()} · {invite.walk.durationMin} min · {invite.status}</p>{invite.message ? <p className="mt-2 text-sm text-slate-700">{invite.message}</p> : null}{invite.status === 'PENDING' ? <div className="mt-3 flex gap-2"><form action="/api/walk-invitations/respond" method="post"><input type="hidden" name="invitationId" value={invite.id} /><input type="hidden" name="action" value="accept" /><button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Accept</button></form><form action="/api/walk-invitations/respond" method="post"><input type="hidden" name="invitationId" value={invite.id} /><input type="hidden" name="action" value="decline" /><button className="rounded-lg border px-4 py-2 text-sm font-medium">Decline</button></form></div> : null}<Link href={`/dogs/${invite.invitedDog.slug}#walk-invitations`} className="mt-3 inline-block text-sm font-medium underline">Open {invite.invitedDog.name} profile</Link></article>)}</div></div>
            <div><h3 className="font-semibold">Sent</h3><div className="mt-2 grid gap-2">{sentInvites.length === 0 ? <p className="text-sm text-slate-600">No invitations sent.</p> : sentInvites.map((invite) => <article key={invite.id} className="rounded-xl border p-4"><p className="font-semibold">{invite.senderDog.name} → {invite.invitedDog.name}</p><p className="mt-1 text-sm text-slate-600">{invite.walk.startsAt.toLocaleString()} · {invite.status}</p><Link href={`/dogs/${invite.senderDog.slug}#walk-invitations`} className="mt-3 inline-block text-sm font-medium underline">Open {invite.senderDog.name} profile</Link></article>)}</div></div>
          </div>
        </Section>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2"><Section title="Walking groups"><p className="text-sm text-slate-600">Group persistence is scheduled after Phase 1 invitation acceptance and notifications are stabilized.</p></Section><Section title="Blocked profiles"><form action="/api/buddies/block" method="post" className="grid gap-3"><input name="email" type="email" placeholder="Owner email for current block workflow" className="rounded-lg border px-3 py-3 text-base" /><input name="reason" placeholder="Optional reason" className="rounded-lg border px-3 py-3 text-base" /><button className="rounded-lg border px-5 py-3 font-medium">Block profile</button></form></Section></section>
    </main>
  );
}
