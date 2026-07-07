import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { UI_ROUTES } from '@/lib/uiRoutes';

export const dynamic = 'force-dynamic';

function routeSummary(notes: string | null) {
  if (!notes) return { intro: '', steps: [] as string[], title: 'Street route', distance: '', duration: '' };
  const [intro, raw] = notes.split('Route plan:');
  if (!raw) return { intro: notes, steps: [] as string[], title: 'Street route', distance: '', duration: '' };
  const jsonStart = raw.indexOf('{');
  const title = jsonStart > 0 ? raw.slice(0, jsonStart).trim() : 'Street route';
  try {
    const parsed = JSON.parse(raw.slice(jsonStart));
    const steps = Array.isArray(parsed.routeSteps) ? parsed.routeSteps.filter((step: unknown) => typeof step === 'string') : [];
    return {
      intro: intro.trim(),
      title,
      steps,
      distance: typeof parsed.distanceMiles === 'number' ? `${parsed.distanceMiles.toFixed(2)} mi` : '',
      duration: typeof parsed.durationMinutes === 'number' ? `${parsed.durationMinutes} min` : ''
    };
  } catch {
    return { intro: intro.trim(), title, steps: ['An older route was saved without current street geometry.'], distance: '', duration: '' };
  }
}

export default async function WalksPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const [walks, invitations] = await Promise.all([
    prisma.walk.findMany({
      where: { OR: [{ requesterId: user.id }, { walkerId: user.id }] },
      orderBy: { startsAt: 'desc' },
      take: 30,
      include: { dog: { select: { name: true, slug: true, breed: true } } }
    }),
    prisma.walkInvitation.findMany({
      where: { OR: [{ senderDog: { ownerId: user.id } }, { invitedDog: { ownerId: user.id } }] },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        senderDog: { select: { name: true, slug: true, ownerId: true } },
        invitedDog: { select: { name: true, slug: true, ownerId: true } },
        walk: { select: { startsAt: true, durationMin: true, status: true } }
      }
    })
  ]).catch(() => [[], []] as const);

  const active = walks.filter((walk) => ['REQUESTED', 'ACCEPTED', 'ACTIVE'].includes(walk.status));
  const pendingInvites = invitations.filter((invite) => invite.status === 'PENDING');

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-sm font-medium text-slate-500">Buddies Phase 1 Walks</p><h1 className="text-3xl font-bold">Walks</h1><p className="mt-2 text-slate-600">Review dog-to-dog invitations and real walking-street route instructions.</p></div>
        <Link href={UI_ROUTES.createWalk} className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white">Create walk</Link>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-4">
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Total walks</p><p className="mt-2 text-3xl font-bold">{walks.length}</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Active</p><p className="mt-2 text-3xl font-bold">{active.length}</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Pending invites</p><p className="mt-2 text-3xl font-bold">{pendingInvites.length}</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Completed</p><p className="mt-2 text-3xl font-bold">{walks.filter((walk) => walk.status === 'COMPLETED').length}</p></article>
      </section>

      <section id="walk-invitations" className="mt-8 scroll-mt-24 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Dog-to-dog walk invitations</h2>
        <div className="mt-4 grid gap-3">
          {invitations.length === 0 ? <p className="text-sm text-slate-600">No walk invitations yet.</p> : invitations.map((invite) => {
            const received = invite.invitedDog.ownerId === user.id;
            return <article key={invite.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{invite.senderDog.name} → {invite.invitedDog.name}</h3><p className="mt-1 text-sm text-slate-600">{received ? 'Invitation received' : 'Invitation sent'} · {invite.walk.startsAt.toLocaleString()} · {invite.walk.durationMin} min</p><p className="mt-1 text-sm font-medium">{invite.status}</p></div><div className="flex gap-2"><Link href={`/dogs/${invite.senderDog.slug}#walk-invitations`} className="rounded-lg border px-3 py-2 text-sm">Sender dog</Link><Link href={`/dogs/${invite.invitedDog.slug}#walk-invitations`} className="rounded-lg border px-3 py-2 text-sm">Invited dog</Link></div></div>{received && invite.status === 'PENDING' ? <div className="mt-3 flex gap-2"><form action="/api/walk-invitations/respond" method="post"><input type="hidden" name="invitationId" value={invite.id} /><input type="hidden" name="action" value="accept" /><button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Accept</button></form><form action="/api/walk-invitations/respond" method="post"><input type="hidden" name="invitationId" value={invite.id} /><input type="hidden" name="action" value="decline" /><button className="rounded-lg border px-4 py-2 text-sm font-medium">Decline</button></form></div> : null}</article>;
          })}
        </div>
      </section>

      <section className="mt-8 grid gap-4">
        {walks.length === 0 ? <div className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">No walks yet</h2><p className="mt-2 text-slate-600">Create your first walk request from the composer.</p></div> : walks.map((walk) => {
          const summary = routeSummary(walk.notes);
          return <article key={walk.id} className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">{walk.dog.name}</h2><p className="mt-1 text-sm text-slate-600">{walk.dog.breed ?? 'Breed not listed'} · {walk.startsAt.toLocaleString()} · {walk.durationMin} min</p><p className="mt-1 text-sm font-semibold">{walk.status}</p></div><Link href={`/dogs/${walk.dog.slug}`} className="rounded-lg border px-4 py-2 text-sm font-medium">Dog profile</Link></div>{summary.intro ? <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{summary.intro}</p> : null}{summary.steps.length ? <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{summary.title}</p><p>{[summary.distance, summary.duration].filter(Boolean).join(' · ')}</p></div><ol className="mt-2 list-decimal space-y-1 pl-5">{summary.steps.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ol></div> : null}</article>;
        })}
      </section>
    </main>
  );
}
