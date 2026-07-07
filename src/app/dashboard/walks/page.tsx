import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { UI_ROUTES } from '@/lib/uiRoutes';

export const dynamic = 'force-dynamic';

type RouteSource = {
  notes: string | null;
  routeName: string | null;
  routeEngine: string | null;
  routeSteps: unknown;
  routeDistanceMiles: number | null;
  routeDurationMin: number | null;
};

type SearchParams = {
  created?: string;
  updated?: string;
  error?: string;
};

function stringSteps(value: unknown) {
  return Array.isArray(value)
    ? value.filter((step): step is string => typeof step === 'string')
    : [];
}

function routeSummary(walk: RouteSource) {
  const storedSteps = stringSteps(walk.routeSteps);
  if (storedSteps.length) {
    return {
      intro: walk.notes ?? '',
      title: walk.routeName || 'Street route',
      engine: walk.routeEngine || 'walking',
      steps: storedSteps,
      distance: walk.routeDistanceMiles === null ? '' : `${walk.routeDistanceMiles.toFixed(2)} mi`,
      duration: walk.routeDurationMin === null ? '' : `${walk.routeDurationMin} min`
    };
  }

  if (!walk.notes) {
    return {
      intro: '',
      steps: [] as string[],
      title: walk.routeName || 'Street route',
      engine: '',
      distance: '',
      duration: ''
    };
  }

  const [intro, raw] = walk.notes.split('Route plan:');
  if (!raw) {
    return {
      intro: walk.notes,
      steps: [] as string[],
      title: walk.routeName || 'Street route',
      engine: '',
      distance: '',
      duration: ''
    };
  }

  const jsonStart = raw.indexOf('{');
  const title = jsonStart > 0 ? raw.slice(0, jsonStart).trim() : walk.routeName || 'Street route';

  try {
    const parsed = JSON.parse(raw.slice(jsonStart));
    return {
      intro: intro.trim(),
      title,
      engine: typeof parsed.routeEngine === 'string' ? parsed.routeEngine : '',
      steps: stringSteps(parsed.routeSteps),
      distance: typeof parsed.distanceMiles === 'number' ? `${parsed.distanceMiles.toFixed(2)} mi` : '',
      duration: typeof parsed.durationMinutes === 'number' ? `${parsed.durationMinutes} min` : ''
    };
  } catch {
    return {
      intro: intro.trim(),
      title,
      engine: '',
      steps: ['An older route was saved without current street geometry.'],
      distance: '',
      duration: ''
    };
  }
}

function pageMessage(params: SearchParams) {
  if (params.created) return 'Walk created.';
  if (params.updated === 'active') return 'Walk started.';
  if (params.updated === 'completed') return 'Walk completed.';
  if (params.updated === 'cancelled') return 'Walk cancelled.';
  if (params.error === 'transition') return 'That status change is not valid for the current walk state.';
  if (params.error) return 'The walk could not be updated.';
  return null;
}

export default async function WalksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');
  const params = await searchParams;
  const message = pageMessage(params);

  const [walks, invitations] = await Promise.all([
    prisma.walk.findMany({
      where: { OR: [{ requesterId: user.id }, { walkerId: user.id }] },
      orderBy: { startsAt: 'desc' },
      take: 30,
      include: {
        dog: { select: { name: true, slug: true, breed: true } }
      }
    }),
    prisma.walkInvitation.findMany({
      where: {
        OR: [
          { senderDog: { ownerId: user.id } },
          { invitedDog: { ownerId: user.id } }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        senderDog: { select: { name: true, slug: true, ownerId: true } },
        invitedDog: { select: { name: true, slug: true, ownerId: true } },
        walk: { select: { id: true, startsAt: true, durationMin: true, status: true } }
      }
    })
  ]).catch(() => [[], []] as const);

  const active = walks.filter((walk) => ['REQUESTED', 'ACCEPTED', 'ACTIVE'].includes(walk.status));
  const pendingInvites = invitations.filter((invite) => invite.status === 'PENDING');

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Buddies Phase 1 Walks</p>
          <h1 className="text-3xl font-bold">Walks</h1>
          <p className="mt-2 text-slate-600">Manage invitations, street routes, and the requested → accepted → active → completed lifecycle.</p>
        </div>
        <Link href={UI_ROUTES.createWalk} className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white">Create walk</Link>
      </div>

      {message ? <div className="mt-6 rounded-xl border bg-white p-4 text-sm text-slate-700 shadow-sm">{message}</div> : null}

      <section className="mt-8 grid gap-4 sm:grid-cols-4">
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Total walks</p><p className="mt-2 text-3xl font-bold">{walks.length}</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Open</p><p className="mt-2 text-3xl font-bold">{active.length}</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Pending invites</p><p className="mt-2 text-3xl font-bold">{pendingInvites.length}</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Completed</p><p className="mt-2 text-3xl font-bold">{walks.filter((walk) => walk.status === 'COMPLETED').length}</p></article>
      </section>

      <section id="walk-invitations" className="mt-8 scroll-mt-24 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Dog-to-dog walk invitations</h2>
        <div className="mt-4 grid gap-3">
          {invitations.length === 0 ? <p className="text-sm text-slate-600">No walk invitations yet.</p> : invitations.map((invite) => {
            const received = invite.invitedDog.ownerId === user.id;
            return (
              <article key={invite.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{invite.senderDog.name} → {invite.invitedDog.name}</h3>
                    <p className="mt-1 text-sm text-slate-600">{received ? 'Invitation received' : 'Invitation sent'} · {invite.walk.startsAt.toLocaleString()} · {invite.walk.durationMin} min</p>
                    <p className="mt-1 text-sm font-medium">{invite.status}</p>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/dogs/${invite.senderDog.slug}#walk-invitations`} className="rounded-lg border px-3 py-2 text-sm">Sender dog</Link>
                    <Link href={`/dogs/${invite.invitedDog.slug}#walk-invitations`} className="rounded-lg border px-3 py-2 text-sm">Invited dog</Link>
                  </div>
                </div>
                {received && invite.status === 'PENDING' ? (
                  <div className="mt-3 flex gap-2">
                    <form action="/api/walk-invitations/respond" method="post"><input type="hidden" name="invitationId" value={invite.id} /><input type="hidden" name="action" value="accept" /><button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Accept</button></form>
                    <form action="/api/walk-invitations/respond" method="post"><input type="hidden" name="invitationId" value={invite.id} /><input type="hidden" name="action" value="decline" /><button className="rounded-lg border px-4 py-2 text-sm font-medium">Decline</button></form>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-8 grid gap-4">
        {walks.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">No walks yet</h2><p className="mt-2 text-slate-600">Create your first walk request from the composer.</p></div>
        ) : walks.map((walk) => {
          const summary = routeSummary(walk);
          const canStart = walk.status === 'ACCEPTED';
          const canComplete = walk.status === 'ACTIVE';
          const canCancel = ['REQUESTED', 'ACCEPTED', 'ACTIVE'].includes(walk.status);

          return (
            <article id={`walk-${walk.id}`} key={walk.id} className="scroll-mt-24 rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{walk.dog.name}</h2>
                  <p className="mt-1 text-sm text-slate-600">{walk.dog.breed ?? 'Breed not listed'} · {walk.startsAt.toLocaleString()} · {walk.durationMin} min</p>
                  <p className="mt-1 text-sm font-semibold">{walk.status}</p>
                </div>
                <Link href={`/dogs/${walk.dog.slug}`} className="rounded-lg border px-4 py-2 text-sm font-medium">Dog profile</Link>
              </div>

              {summary.intro ? <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{summary.intro}</p> : null}

              {summary.steps.length ? (
                <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div><p className="font-semibold">{summary.title}</p>{summary.engine ? <p className="text-xs text-slate-500">Engine: {summary.engine}</p> : null}</div>
                    <p>{[summary.distance, summary.duration].filter(Boolean).join(' · ')}</p>
                  </div>
                  <ol className="mt-2 list-decimal space-y-1 pl-5">{summary.steps.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ol>
                </div>
              ) : null}

              {(canStart || canComplete || canCancel) ? (
                <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                  {canStart ? <form action="/api/walks/status" method="post"><input type="hidden" name="walkId" value={walk.id} /><input type="hidden" name="action" value="start" /><button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Start walk</button></form> : null}
                  {canComplete ? <form action="/api/walks/status" method="post"><input type="hidden" name="walkId" value={walk.id} /><input type="hidden" name="action" value="complete" /><button className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white">Complete walk</button></form> : null}
                  {canCancel ? <form action="/api/walks/status" method="post"><input type="hidden" name="walkId" value={walk.id} /><input type="hidden" name="action" value="cancel" /><button className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700">Cancel walk</button></form> : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
    </main>
  );
}
