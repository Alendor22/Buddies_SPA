import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { UI_ROUTES } from '@/lib/uiRoutes';

export const dynamic = 'force-dynamic';

type SearchParams = {
  sent?: string;
  accepted?: string;
  declined?: string;
  cancelled?: string;
  error?: string;
  q?: string;
  walk?: string;
  dog?: string;
  invited?: string;
};

type DogSummary = {
  id: string;
  name: string;
  slug: string;
  breed: string | null;
  status: string;
  photoUrl: string | null;
  ownerId: string;
  owner: { city: string | null };
};

function pageMessage(params: SearchParams) {
  if (params.walk === 'sent') return `${params.dog ?? 'Your dog'} invited ${params.invited ?? 'a buddy'} to a walk.`;
  if (params.sent) return 'Dog buddy request sent.';
  if (params.accepted) return 'Dog buddy request accepted.';
  if (params.declined) return 'Dog buddy request declined.';
  if (params.cancelled) return 'Dog buddy request cancelled.';
  if (params.error === 'respond-first') return 'A reverse request is already pending. Review that request first.';
  if (params.error === 'not-dog-buddies') return 'Those two dogs must be buddies before a walk invitation can be sent.';
  if (params.error === 'walk-invalid') return 'Choose a valid dog buddy pair and walk time.';
  if (params.error === 'exists') return 'Those dogs are already buddies.';
  if (params.error) return 'The dog-network action could not be completed.';
  return null;
}

function DogAvatar({ dog }: { dog: { name: string; photoUrl: string | null } }) {
  if (dog.photoUrl) {
    return <img src={dog.photoUrl} alt={`${dog.name} avatar`} className="h-14 w-14 rounded-full object-cover" />;
  }
  return <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-2xl text-white">🐶</div>;
}

function DogIdentity({ dog, caption }: { dog: DogSummary; caption?: string }) {
  return (
    <div className="flex gap-3">
      <DogAvatar dog={dog} />
      <div className="min-w-0">
        <h3 className="font-semibold">{dog.name}</h3>
        <p className="text-sm text-slate-600">{dog.breed ?? 'Breed not listed'} · {dog.status}</p>
        <p className="text-xs text-slate-500">Owner hidden · {dog.owner.city ?? 'Location not set'}</p>
        {caption ? <p className="mt-1 text-xs text-slate-500">{caption}</p> : null}
      </div>
    </div>
  );
}

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function BuddiesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const params = await searchParams;
  const query = String(params.q ?? '').trim();
  const message = pageMessage(params);

  const myDogs = await prisma.dog.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, slug: true, breed: true, status: true, photoUrl: true }
  });
  const myDogIds = myDogs.map((dog) => dog.id);

  const [incoming, outgoing, dogBuddyLinks, suggestedDogs, invitations] = await Promise.all([
    prisma.dogBuddyRequest.findMany({
      where: { receiverDogId: { in: myDogIds }, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: {
        senderDog: { select: { id: true, name: true, slug: true, breed: true, status: true, photoUrl: true, ownerId: true, owner: { select: { city: true } } } },
        receiverDog: { select: { id: true, name: true, slug: true } }
      }
    }),
    prisma.dogBuddyRequest.findMany({
      where: { senderDogId: { in: myDogIds }, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: {
        senderDog: { select: { id: true, name: true, slug: true } },
        receiverDog: { select: { id: true, name: true, slug: true, breed: true, status: true, photoUrl: true, ownerId: true, owner: { select: { city: true } } } }
      }
    }),
    prisma.dogBuddy.findMany({
      where: { OR: [{ dogAId: { in: myDogIds } }, { dogBId: { in: myDogIds } }] },
      orderBy: { createdAt: 'desc' },
      include: {
        dogA: { select: { id: true, name: true, slug: true, breed: true, status: true, photoUrl: true, ownerId: true, owner: { select: { city: true } } } },
        dogB: { select: { id: true, name: true, slug: true, breed: true, status: true, photoUrl: true, ownerId: true, owner: { select: { city: true } } } }
      }
    }),
    prisma.dog.findMany({
      where: {
        ownerId: { not: user.id },
        ...(query ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' as const } },
            { breed: { contains: query, mode: 'insensitive' as const } },
            { owner: { city: { contains: query, mode: 'insensitive' as const } } }
          ]
        } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, name: true, slug: true, breed: true, status: true, photoUrl: true, ownerId: true, owner: { select: { city: true } } }
    }),
    prisma.walkInvitation.findMany({
      where: { OR: [{ senderDog: { ownerId: user.id } }, { invitedDog: { ownerId: user.id } }] },
      orderBy: { createdAt: 'desc' },
      take: 24,
      include: {
        senderDog: { select: { id: true, name: true, slug: true, ownerId: true } },
        invitedDog: { select: { id: true, name: true, slug: true, ownerId: true } },
        walk: { select: { id: true, startsAt: true, durationMin: true, status: true } }
      }
    })
  ]);

  const connectedDogIds = new Set<string>();
  const trustedConnections = dogBuddyLinks.map((link) => {
    const dogAIsMine = myDogIds.includes(link.dogAId);
    const myDog = dogAIsMine ? link.dogA : link.dogB;
    const otherDog = dogAIsMine ? link.dogB : link.dogA;
    connectedDogIds.add(otherDog.id);
    return { id: link.id, myDog, otherDog };
  });

  const pendingDogIds = new Set<string>([
    ...incoming.map((request) => request.senderDogId),
    ...outgoing.map((request) => request.receiverDogId)
  ]);
  const suggested = (suggestedDogs as DogSummary[])
    .filter((dog) => !connectedDogIds.has(dog.id) && !pendingDogIds.has(dog.id))
    .slice(0, 12);

  const incomingInvites = invitations.filter((invite) => invite.invitedDog.ownerId === user.id);
  const sentInvites = invitations.filter((invite) => invite.senderDog.ownerId === user.id);
  const inviteLink = `https://buddies.vercel.app/dashboard/buddies?inviteFrom=${user.id}`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Buddies Phase 1 Dog Graph</p>
          <h1 className="text-3xl font-bold">Buddies</h1>
          <p className="mt-2 text-slate-600">Connections, requests, and walk invitations are now linked to specific dog profiles.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={UI_ROUTES.dashboard} className="rounded-lg border px-4 py-2">Dashboard</Link>
          <Link href="/dashboard/buddies/invite" className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white">Invite QR</Link>
        </div>
      </div>

      {message ? <div className="mt-6 rounded-xl border bg-white p-4 text-sm text-slate-700 shadow-sm">{message}</div> : null}

      <section className="mt-8 grid gap-4 sm:grid-cols-4">
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Dog buddies</p><p className="mt-2 text-3xl font-bold">{trustedConnections.length}</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Requests received</p><p className="mt-2 text-3xl font-bold">{incoming.length}</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Walk invites received</p><p className="mt-2 text-3xl font-bold">{incomingInvites.length}</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Walk invites sent</p><p className="mt-2 text-3xl font-bold">{sentInvites.length}</p></article>
      </section>

      {myDogs.length === 0 ? (
        <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Create a dog profile first</h2>
          <p className="mt-2 text-slate-600">Dog-to-dog requests require at least one owned profile.</p>
          <Link href={UI_ROUTES.addProfile} className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 font-medium text-white">Add dog</Link>
        </section>
      ) : null}

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <Section title="Search dogs">
          <form action={UI_ROUTES.buddies} method="get" className="grid gap-3">
            <input name="q" defaultValue={query} placeholder="Search dog name, breed, city, or neighborhood" className="rounded-lg border px-3 py-3 text-base" />
            <button className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Search</button>
          </form>
        </Section>
        <Section title="Invite via link">
          <p className="break-all text-sm text-slate-600">{inviteLink}</p>
          <div className="mt-3 flex flex-wrap gap-2"><Link href="/dashboard/buddies/invite" className="rounded-lg border px-4 py-2">Open invite QR</Link><a href={`sms:?&body=${encodeURIComponent(`Join my dog network on Buddies: ${inviteLink}`)}`} className="rounded-lg border px-4 py-2">Send link</a></div>
        </Section>
      </section>

      <div className="mt-8">
        <Section id="buddy-requests" title="Dog buddy requests">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="font-semibold">Incoming</h3>
              <div className="mt-3 grid gap-3">
                {incoming.length === 0 ? <p className="text-sm text-slate-600">No pending incoming requests.</p> : incoming.map((request) => (
                  <article key={request.id} className="rounded-xl border p-4">
                    <DogIdentity dog={request.senderDog as DogSummary} caption={`Request for ${request.receiverDog.name}`} />
                    {request.message ? <p className="mt-3 text-sm text-slate-700">{request.message}</p> : null}
                    <div className="mt-3 flex gap-2">
                      <form action="/api/dog-buddies/respond" method="post"><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="action" value="accept" /><button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Accept</button></form>
                      <form action="/api/dog-buddies/respond" method="post"><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="action" value="decline" /><button className="rounded-lg border px-4 py-2 text-sm font-medium">Decline</button></form>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold">Sent</h3>
              <div className="mt-3 grid gap-3">
                {outgoing.length === 0 ? <p className="text-sm text-slate-600">No sent requests pending.</p> : outgoing.map((request) => (
                  <article key={request.id} className="rounded-xl border p-4">
                    <DogIdentity dog={request.receiverDog as DogSummary} caption={`Sent by ${request.senderDog.name}`} />
                    <form action="/api/dog-buddies/respond" method="post" className="mt-3"><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="action" value="cancel" /><button className="rounded-lg border px-4 py-2 text-sm font-medium">Cancel request</button></form>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </Section>
      </div>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <Section title="Suggested dogs">
          <div className="grid gap-3">
            {suggested.length === 0 ? <p className="text-sm text-slate-600">No unmatched dog profiles found.</p> : suggested.map((dog) => (
              <article key={dog.id} className="rounded-xl border p-4">
                <DogIdentity dog={dog} />
                <form action="/api/buddies/request" method="post" className="mt-3 grid gap-2">
                  <input type="hidden" name="receiverDogId" value={dog.id} />
                  <select name="senderDogId" required className="rounded-lg border px-3 py-2 text-sm">{myDogs.map((myDog) => <option key={myDog.id} value={myDog.id}>{myDog.name} requests {dog.name}</option>)}</select>
                  <div className="flex gap-2"><input name="note" placeholder="Optional dog-to-dog note" className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm" /><button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Send</button></div>
                </form>
              </article>
            ))}
          </div>
        </Section>

        <Section title="Trusted dog network">
          <div className="grid gap-3">
            {trustedConnections.length === 0 ? <p className="text-sm text-slate-600">No accepted dog buddies yet.</p> : trustedConnections.map((connection) => (
              <article key={connection.id} className="rounded-xl border p-4">
                <p className="font-semibold">{connection.myDog.name} ↔ {connection.otherDog.name}</p>
                <p className="mt-1 text-sm text-slate-600">Direct dog buddy relationship</p>
                <div className="mt-3 flex gap-2"><Link href={`/dogs/${connection.myDog.slug}#walk-invitations`} className="rounded-lg border px-3 py-2 text-sm">{connection.myDog.name}</Link><Link href={`/dogs/${connection.otherDog.slug}#walk-invitations`} className="rounded-lg border px-3 py-2 text-sm">{connection.otherDog.name}</Link></div>
              </article>
            ))}
          </div>
        </Section>
      </section>

      <section id="walk-invitations" className="mt-8 scroll-mt-24 grid gap-6 lg:grid-cols-2">
        <Section title="Send walk invitation">
          <form action="/api/buddies/walk-invite" method="post" className="grid gap-3">
            <label className="grid gap-2 text-sm font-medium">Dog buddy pair<select name="connection" required className="rounded-lg border px-3 py-3 text-base"><option value="">Select connection</option>{trustedConnections.map((connection) => <option key={connection.id} value={`${connection.myDog.id}:${connection.otherDog.id}`}>{connection.myDog.name} → {connection.otherDog.name}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-medium">Starts at<input name="startsAt" type="datetime-local" required className="rounded-lg border px-3 py-3 text-base" /></label>
            <label className="grid gap-2 text-sm font-medium">Note<input name="note" placeholder="Optional walk note" className="rounded-lg border px-3 py-3 text-base" /></label>
            <button disabled={!trustedConnections.length} className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white disabled:opacity-50">Send dog-to-dog invite</button>
          </form>
        </Section>

        <Section title="Walk invitation activity">
          <div className="grid gap-5">
            <div>
              <h3 className="font-semibold">Received</h3>
              <div className="mt-2 grid gap-2">{incomingInvites.length === 0 ? <p className="text-sm text-slate-600">No invitations received.</p> : incomingInvites.map((invite) => <article key={invite.id} className="rounded-xl border p-4"><p className="font-semibold">{invite.senderDog.name} invited {invite.invitedDog.name}</p><p className="mt-1 text-sm text-slate-600">{invite.walk.startsAt.toLocaleString()} · {invite.status}</p>{invite.status === 'PENDING' ? <div className="mt-3 flex gap-2"><form action="/api/walk-invitations/respond" method="post"><input type="hidden" name="invitationId" value={invite.id} /><input type="hidden" name="action" value="accept" /><button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Accept</button></form><form action="/api/walk-invitations/respond" method="post"><input type="hidden" name="invitationId" value={invite.id} /><input type="hidden" name="action" value="decline" /><button className="rounded-lg border px-4 py-2 text-sm font-medium">Decline</button></form></div> : null}</article>)}</div>
            </div>
            <div>
              <h3 className="font-semibold">Sent</h3>
              <div className="mt-2 grid gap-2">{sentInvites.length === 0 ? <p className="text-sm text-slate-600">No invitations sent.</p> : sentInvites.map((invite) => <article key={invite.id} className="rounded-xl border p-4"><p className="font-semibold">{invite.senderDog.name} → {invite.invitedDog.name}</p><p className="mt-1 text-sm text-slate-600">{invite.walk.startsAt.toLocaleString()} · {invite.status}</p></article>)}</div>
            </div>
          </div>
        </Section>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <Section title="Walking groups"><p className="text-sm text-slate-600">Group persistence follows stabilization of Phase 1 dog relationships, invitations, and notifications.</p></Section>
        <Section title="Blocked profiles"><form action="/api/buddies/block" method="post" className="grid gap-3"><input name="email" type="email" placeholder="Owner email for current block workflow" className="rounded-lg border px-3 py-3 text-base" /><input name="reason" placeholder="Optional reason" className="rounded-lg border px-3 py-3 text-base" /><button className="rounded-lg border px-5 py-3 font-medium">Block profile</button></form></Section>
      </section>
    </main>
  );
}
