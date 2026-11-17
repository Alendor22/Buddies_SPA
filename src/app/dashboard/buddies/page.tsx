import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import DogBuddyRequestControl from '@/components/DogBuddyRequestControl';
import WalkInvitationForm from '@/components/WalkInvitationForm';
import { getAppUrl } from '@/lib/appUrl';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { UI_ROUTES } from '@/lib/uiRoutes';
import { listBlockedUserIds } from '@/lib/social/repository';

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
  from?: string;
  to?: string;
  inviteFrom?: string;
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

type BuddyUiStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
type PairState = { direction: 'OUTGOING' | 'INCOMING'; status: BuddyUiStatus; requestId: string };

function pageMessage(params: SearchParams) {
  if (params.walk === 'sent') return `${params.dog ?? 'Your dog'} invited ${params.invited ?? 'a buddy'} to a walk.`;
  if (params.sent) return `${params.from ?? 'Your dog'} sent ${params.to ?? 'a dog'} a buddy request.`;
  if (params.accepted) return 'Dog buddy request accepted.';
  if (params.declined) return 'Dog buddy request declined.';
  if (params.cancelled) return 'Dog buddy request cancelled.';
  if (params.error === 'respond-first') return 'A reverse request is already pending. Review that request first.';
  if (params.error === 'not-dog-buddies') return 'Those two dogs must be buddies before a walk invitation can be sent.';
  if (params.error === 'walk-invalid') return 'Choose a valid dog buddy pair and walk time.';
  if (params.error === 'walk-time') return 'Choose a current or future walk time.';
  if (params.error === 'walk-resolved') return 'That walk invitation was already resolved.';
  if (params.error === 'request-resolved') return 'That buddy request was already resolved.';
  if (params.error === 'exists') return 'Those dogs are already buddies.';
  if (params.error) return 'The dog-network action could not be completed.';
  if (params.inviteFrom) return 'Invite opened. Choose one of the highlighted dogs to send a dog-to-dog buddy request.';
  return null;
}

function DogAvatar({ dog }: { dog: { name: string; photoUrl: string | null } }) {
  if (dog.photoUrl) return <Image src={dog.photoUrl} alt={`${dog.name} avatar`} width={56} height={56} unoptimized className="h-14 w-14 shrink-0 rounded-full object-cover" />;
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
  return <section id={id} className="scroll-mt-24 rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">{title}</h2><div className="mt-4">{children}</div></section>;
}

export default async function BuddiesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const params = await searchParams;
  const query = String(params.q ?? '').trim();
  const inviteOwnerId = params.inviteFrom && params.inviteFrom !== user.id ? params.inviteFrom.trim() : null;
  const message = pageMessage(params);

  const myDogs = await prisma.dog.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, slug: true, breed: true, status: true, photoUrl: true }
  });
  const myDogIds = myDogs.map((dog) => dog.id);

  const [requestHistory, dogBuddyLinks, suggestedDogs, invitations] = await Promise.all([
    prisma.dogBuddyRequest.findMany({
      where: { OR: [{ receiverDogId: { in: myDogIds } }, { senderDogId: { in: myDogIds } }] },
      orderBy: { updatedAt: 'desc' },
      take: 500,
      include: {
        senderDog: { select: { id: true, name: true, slug: true, breed: true, status: true, photoUrl: true, ownerId: true, owner: { select: { city: true } } } },
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
        ...(inviteOwnerId ? { ownerId: inviteOwnerId } : { ownerId: { not: user.id } }),
        ...(query ? { OR: [
          { name: { contains: query, mode: 'insensitive' as const } },
          { breed: { contains: query, mode: 'insensitive' as const } },
          { owner: { city: { contains: query, mode: 'insensitive' as const } } }
        ] } : {})
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

  const incoming = requestHistory.filter((request) => myDogIds.includes(request.receiverDogId) && request.status === 'PENDING');
  const outgoing = requestHistory.filter((request) => myDogIds.includes(request.senderDogId) && request.status === 'PENDING');
  const connectedDogIds = new Set<string>();
  const trustedConnections = dogBuddyLinks.map((link) => {
    const dogAIsMine = myDogIds.includes(link.dogAId);
    const myDog = dogAIsMine ? link.dogA : link.dogB;
    const otherDog = dogAIsMine ? link.dogB : link.dogA;
    connectedDogIds.add(otherDog.id);
    return { id: link.id, myDog, otherDog };
  });
  const suggested = (suggestedDogs as DogSummary[]).filter((dog) => !connectedDogIds.has(dog.id)).slice(0, 12);

  const requestStatesFor = (receiverDogId: string) => {
    const states: Record<string, PairState | undefined> = {};
    for (const myDog of myDogs) {
      const outgoingRequest = requestHistory.find((request) => request.senderDogId === myDog.id && request.receiverDogId === receiverDogId);
      const incomingRequest = requestHistory.find((request) => request.senderDogId === receiverDogId && request.receiverDogId === myDog.id);
      const request = outgoingRequest ?? incomingRequest;
      if (request) states[myDog.id] = { direction: outgoingRequest ? 'OUTGOING' : 'INCOMING', status: request.status as BuddyUiStatus, requestId: request.id };
    }
    return states;
  };

  const blockedUserIds = await listBlockedUserIds(user.id);
  const blockedByUsers = await prisma.socialBlock.findMany({ where: { blockedId: user.id }, select: { blockerId: true } });
  const excludedOwnerIds = [...new Set([user.id, ...blockedUserIds, ...blockedByUsers.map((block) => block.blockerId)])];
  const walkInviteDogs = await prisma.dog.findMany({
    where: {
      status: 'SAFE',
      ownerId: { notIn: excludedOwnerIds },
      owner: { socialPrivacy: { is: { discoverable: true, allowWalkInvites: true } } }
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, name: true }
  });

  const incomingInvites = invitations.filter((invite) => invite.invitedDog.ownerId === user.id);
  const sentInvites = invitations.filter((invite) => invite.senderDog.ownerId === user.id);
  const inviteLink = `${getAppUrl()}/dashboard/buddies?inviteFrom=${encodeURIComponent(user.id)}`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-sm font-medium text-slate-500">Buddies Phase 2 Dog Graph</p><h1 className="text-3xl font-bold">Buddies</h1><p className="mt-2 text-slate-600">Create dog-to-dog relationships, invitations, and trusted walking connections.</p></div>
        <div className="flex flex-wrap gap-2"><Link href={UI_ROUTES.dashboard} className="rounded-lg border px-4 py-2">Dashboard</Link><Link href="/dashboard/buddies/invite" className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white">Invite QR</Link></div>
      </div>

      {message ? <div className="mt-6 rounded-xl border bg-white p-4 text-sm text-slate-700 shadow-sm">{message}</div> : null}

      <section className="mt-8 grid gap-4 sm:grid-cols-4">
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Dog buddies</p><p className="mt-2 text-3xl font-bold">{trustedConnections.length}</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Requests received</p><p className="mt-2 text-3xl font-bold">{incoming.length}</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Walk invites received</p><p className="mt-2 text-3xl font-bold">{incomingInvites.length}</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Walk invites sent</p><p className="mt-2 text-3xl font-bold">{sentInvites.length}</p></article>
      </section>

      {myDogs.length === 0 ? <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">Create a dog profile first</h2><p className="mt-2 text-slate-600">Dog-to-dog requests require at least one owned profile.</p><Link href={UI_ROUTES.addProfile} className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 font-medium text-white">Add dog</Link></section> : null}

      <section className="mt-8"><Section title="Search dogs"><form action={`${UI_ROUTES.buddies}#dog-search-results`} method="get" className="grid gap-3"><input name="q" defaultValue={query} placeholder="Search dog name, breed, city, or neighborhood" className="rounded-lg border px-3 py-3 text-base" /><button className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Search</button></form></Section></section>
      <div id="dog-search-results" className="mt-4 scroll-mt-24">
        <Section title={query ? `Search results for “${query}”` : inviteOwnerId ? 'Dogs from your invite' : 'Suggested dogs'}><div className="grid gap-3">{suggested.length === 0 ? <p className="text-sm text-slate-600">{query ? `No dogs match “${query}”. Try a name, breed, or city.` : 'No unmatched dog profiles found.'}</p> : suggested.map((dog) => <article key={dog.id} className="rounded-xl border p-4"><DogIdentity dog={dog} /><DogBuddyRequestControl receiverDog={{ id: dog.id, name: dog.name }} senderDogs={myDogs.map((myDog) => ({ id: myDog.id, name: myDog.name }))} initialStates={requestStatesFor(dog.id)} /></article>)}</div></Section>
      </div>
      <section className="mt-8"><Section title="Invite via link"><p className="break-all text-sm text-slate-600">{inviteLink}</p><div className="mt-3 flex flex-wrap gap-2"><Link href="/dashboard/buddies/invite" className="rounded-lg border px-4 py-2">Open invite QR</Link><a href={`sms:?&body=${encodeURIComponent(`Join my dog network on Buddies: ${inviteLink}`)}`} className="rounded-lg border px-4 py-2">Send link</a></div></Section></section>

      <div className="mt-8"><Section id="buddy-requests" title="Dog buddy requests"><div className="grid gap-6 lg:grid-cols-2"><div><h3 className="font-semibold">Incoming</h3><div className="mt-3 grid gap-3">{incoming.length === 0 ? <p className="text-sm text-slate-600">No pending incoming requests.</p> : incoming.map((request) => <article key={request.id} className="rounded-xl border p-4"><DogIdentity dog={request.senderDog as DogSummary} caption={`Request for ${request.receiverDog.name}`} />{request.message ? <p className="mt-3 text-sm text-slate-700">{request.message}</p> : null}<div className="mt-3 flex gap-2"><form action="/api/dog-buddies/respond" method="post"><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="action" value="accept" /><button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Accept</button></form><form action="/api/dog-buddies/respond" method="post"><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="action" value="decline" /><button className="rounded-lg border px-4 py-2 text-sm font-medium">Decline</button></form></div></article>)}</div></div><div><h3 className="font-semibold">Sent</h3><div className="mt-3 grid gap-3">{outgoing.length === 0 ? <p className="text-sm text-slate-600">No sent requests pending.</p> : outgoing.map((request) => <article key={request.id} className="rounded-xl border p-4"><DogIdentity dog={request.receiverDog as DogSummary} caption={`${request.senderDog.name} → ${request.receiverDog.name} · REQUEST SENT`} /><form action="/api/dog-buddies/respond" method="post" className="mt-3"><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="action" value="cancel" /><button className="rounded-lg border px-4 py-2 text-sm font-medium">Cancel request</button></form></article>)}</div></div></div></Section></div>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <Section title="Trusted dog network"><div className="grid gap-3">{trustedConnections.length === 0 ? <p className="text-sm text-slate-600">No accepted dog buddies yet.</p> : trustedConnections.map((connection) => <article key={connection.id} className="rounded-xl border p-4"><p className="font-semibold">{connection.myDog.name} ↔ {connection.otherDog.name}</p><p className="mt-1 text-sm text-slate-600">Direct dog buddy relationship</p><div className="mt-3 flex gap-2"><Link href={`/dogs/${connection.myDog.slug}#walk-invitations`} className="rounded-lg border px-3 py-2 text-sm">{connection.myDog.name}</Link><Link href={`/dogs/${connection.otherDog.slug}`} className="rounded-lg border px-3 py-2 text-sm">{connection.otherDog.name}</Link></div></article>)}</div></Section>
      </section>

      <section id="walk-invitations" className="mt-8 scroll-mt-24 grid gap-6 lg:grid-cols-2">
        <Section title="Send walk invitation"><WalkInvitationForm senderDogs={myDogs.filter((dog) => dog.status === 'SAFE').map((dog) => ({ id: dog.id, name: dog.name }))} invitedDogs={walkInviteDogs} /></Section>
        <Section title="Walk invitation activity"><div className="grid gap-5"><div><h3 className="font-semibold">Received</h3><div className="mt-2 grid gap-2">{incomingInvites.length === 0 ? <p className="text-sm text-slate-600">No invitations received.</p> : incomingInvites.map((invite) => <article key={invite.id} className="rounded-xl border p-4"><p className="font-semibold">{invite.senderDog.name} invited {invite.invitedDog.name}</p><p className="mt-1 text-sm text-slate-600">{invite.walk.startsAt.toLocaleString()} · {invite.status}</p>{invite.status === 'PENDING' ? <div className="mt-3 flex gap-2"><form action="/api/walk-invitations/respond" method="post"><input type="hidden" name="invitationId" value={invite.id} /><input type="hidden" name="action" value="accept" /><button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Accept</button></form><form action="/api/walk-invitations/respond" method="post"><input type="hidden" name="invitationId" value={invite.id} /><input type="hidden" name="action" value="decline" /><button className="rounded-lg border px-4 py-2 text-sm font-medium">Decline</button></form></div> : null}</article>)}</div></div><div><h3 className="font-semibold">Sent</h3><div className="mt-2 grid gap-2">{sentInvites.length === 0 ? <p className="text-sm text-slate-600">No invitations sent.</p> : sentInvites.map((invite) => <article key={invite.id} className="rounded-xl border p-4"><p className="font-semibold">{invite.senderDog.name} → {invite.invitedDog.name}</p><p className="mt-1 text-sm text-slate-600">{invite.walk.startsAt.toLocaleString()} · {invite.status}</p>{invite.status === 'PENDING' ? <form action="/api/walk-invitations/respond" method="post" className="mt-3"><input type="hidden" name="invitationId" value={invite.id} /><input type="hidden" name="action" value="cancel" /><button className="rounded-lg border px-4 py-2 text-sm font-medium">Cancel invite</button></form> : null}</article>)}</div></div></div></Section>
      </section>
    </main>
  );
}
