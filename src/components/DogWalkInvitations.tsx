import Link from 'next/link';
import { prisma } from '@/lib/db';

export default async function DogWalkInvitations({ dogId, dogName, isOwner }: { dogId: string; dogName: string; isOwner: boolean }) {
  if (!isOwner) return null;

  const [received, sent] = await Promise.all([
    prisma.walkInvitation.findMany({
      where: { invitedDogId: dogId },
      orderBy: { createdAt: 'desc' },
      take: 12,
      include: {
        senderDog: { select: { name: true, slug: true } },
        walk: { select: { startsAt: true, durationMin: true } }
      }
    }),
    prisma.walkInvitation.findMany({
      where: { senderDogId: dogId },
      orderBy: { createdAt: 'desc' },
      take: 12,
      include: {
        invitedDog: { select: { name: true, slug: true } },
        walk: { select: { startsAt: true, durationMin: true } }
      }
    })
  ]);

  return (
    <section id="walk-invitations" className="mt-7 scroll-mt-24 rounded-xl border p-4">
      <h2 className="font-semibold">Walk invitations for {dogName}</h2>
      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Received</h3>
          <div className="mt-2 grid gap-2">
            {received.length === 0 ? <p className="text-sm text-slate-600">No walk invitations received.</p> : received.map((invite) => (
              <article key={invite.id} className="rounded-lg bg-slate-50 p-3">
                <p className="font-medium">{invite.senderDog.name} invited {dogName}</p>
                <p className="mt-1 text-sm text-slate-600">{invite.walk.startsAt.toLocaleString()} · {invite.walk.durationMin} min · {invite.status}</p>
                {invite.message ? <p className="mt-1 text-sm text-slate-700">{invite.message}</p> : null}
                <Link href={`/dogs/${invite.senderDog.slug}`} className="mt-2 inline-block text-sm font-medium underline">Open {invite.senderDog.name}</Link>
                {invite.status === 'PENDING' ? <div className="mt-3 flex gap-2"><form action="/api/walk-invitations/respond" method="post"><input type="hidden" name="invitationId" value={invite.id} /><input type="hidden" name="action" value="accept" /><button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white">Accept</button></form><form action="/api/walk-invitations/respond" method="post"><input type="hidden" name="invitationId" value={invite.id} /><input type="hidden" name="action" value="decline" /><button className="rounded-lg border px-3 py-2 text-sm font-medium">Decline</button></form></div> : null}
              </article>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Sent</h3>
          <div className="mt-2 grid gap-2">
            {sent.length === 0 ? <p className="text-sm text-slate-600">No walk invitations sent.</p> : sent.map((invite) => (
              <article key={invite.id} className="rounded-lg bg-slate-50 p-3">
                <p className="font-medium">{dogName} invited {invite.invitedDog.name}</p>
                <p className="mt-1 text-sm text-slate-600">{invite.walk.startsAt.toLocaleString()} · {invite.status}</p>
                {invite.message ? <p className="mt-1 text-sm text-slate-700">{invite.message}</p> : null}
                <Link href={`/dogs/${invite.invitedDog.slug}`} className="mt-2 inline-block text-sm font-medium underline">Open {invite.invitedDog.name}</Link>
                {invite.status === 'PENDING' ? <form action="/api/walk-invitations/respond" method="post" className="mt-3"><input type="hidden" name="invitationId" value={invite.id} /><input type="hidden" name="action" value="cancel" /><button className="rounded-lg border px-3 py-2 text-sm font-medium">Cancel invite</button></form> : null}
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
