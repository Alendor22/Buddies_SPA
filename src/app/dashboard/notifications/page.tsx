import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { UI_ROUTES } from '@/lib/uiRoutes';

export const dynamic = 'force-dynamic';

const routeLabels: Record<string, string> = {
  buddyRequests: 'Dog buddy requests',
  walkInvites: 'Walk invitations',
  lostDog: 'Lost dog alerts',
  sightings: 'Sightings',
  records: 'Vet records',
  system: 'System'
};

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      dog: { select: { name: true, slug: true, breed: true } },
      walk: { select: { startsAt: true, status: true, durationMin: true } },
      walkInvitation: {
        select: {
          status: true,
          senderDog: { select: { name: true, slug: true } },
          invitedDog: { select: { name: true, slug: true } }
        }
      },
      dogBuddyRequest: {
        select: {
          status: true,
          senderDog: { select: { name: true, slug: true } },
          receiverDog: { select: { name: true, slug: true } }
        }
      },
      sighting: {
        select: { latitude: true, longitude: true, note: true, createdAt: true }
      }
    }
  }).catch(() => []);

  const unread = notifications.filter((notification) => !notification.readAt);
  const counts = notifications.reduce<Record<string, number>>((accumulator, notification) => {
    if (!notification.readAt) {
      accumulator[notification.routeKey] = (accumulator[notification.routeKey] ?? 0) + 1;
    }
    return accumulator;
  }, {});

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Buddies Phase 1 Notification Center</p>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="mt-2 text-slate-600">Every badge maps to a persistent alert, its exact dog relationship, and a specific UI destination.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={UI_ROUTES.dashboard} className="rounded-lg border px-4 py-2">Dashboard</Link>
          <Link href={UI_ROUTES.lostReport} className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white">Lost dog</Link>
        </div>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-4">
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Unread</p><p className="mt-2 text-4xl font-bold">{unread.length}</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Dog requests</p><p className="mt-2 text-4xl font-bold">{counts.buddyRequests ?? 0}</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Walk invitations</p><p className="mt-2 text-4xl font-bold">{counts.walkInvites ?? 0}</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Safety</p><p className="mt-2 text-4xl font-bold">{(counts.lostDog ?? 0) + (counts.sightings ?? 0)}</p></article>
      </section>

      <section className="mt-6 flex flex-wrap gap-2">
        <Link href={UI_ROUTES.buddyRequests} className="rounded-full border px-4 py-2 text-sm font-medium">Dog requests</Link>
        <Link href={UI_ROUTES.walkInvites} className="rounded-full border px-4 py-2 text-sm font-medium">Walk invitations</Link>
        <Link href={UI_ROUTES.lostReport} className="rounded-full border px-4 py-2 text-sm font-medium">Lost dog center</Link>
        <Link href={UI_ROUTES.records} className="rounded-full border px-4 py-2 text-sm font-medium">Vet records</Link>
        {unread.length ? <form action="/api/notifications/read" method="post"><input type="hidden" name="all" value="1" /><input type="hidden" name="returnTo" value={UI_ROUTES.alerts} /><button className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white">Mark all read</button></form> : null}
      </section>

      <section className="mt-8 grid gap-4">
        {notifications.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">No notifications</h2><p className="mt-2 text-slate-600">Dog buddy requests, walk invitations, safety alerts, sightings, and record reminders will appear here.</p></div>
        ) : notifications.map((notification) => (
          <article key={notification.id} className={`rounded-2xl border bg-white p-5 shadow-sm ${notification.readAt ? 'opacity-70' : 'border-slate-400'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{routeLabels[notification.routeKey] ?? notification.routeKey}</span>
                  {!notification.readAt ? <span className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white">Unread</span> : <span className="text-xs text-slate-500">Read</span>}
                </div>
                <h2 className="mt-3 text-lg font-semibold">{notification.title}</h2>
                {notification.body ? <p className="mt-1 text-sm text-slate-600">{notification.body}</p> : null}
                {notification.dogBuddyRequest ? <p className="mt-2 text-sm font-medium text-slate-700">{notification.dogBuddyRequest.senderDog.name} → {notification.dogBuddyRequest.receiverDog.name} · {notification.dogBuddyRequest.status}</p> : null}
                {notification.walkInvitation ? <p className="mt-2 text-sm font-medium text-slate-700">{notification.walkInvitation.senderDog.name} → {notification.walkInvitation.invitedDog.name} · {notification.walkInvitation.status}</p> : null}
                {notification.walk ? <p className="mt-1 text-sm text-slate-600">{notification.walk.startsAt.toLocaleString()} · {notification.walk.durationMin} min · {notification.walk.status}</p> : null}
                {notification.dog ? <p className="mt-1 text-sm text-slate-600">Dog: {notification.dog.name}{notification.dog.breed ? ` · ${notification.dog.breed}` : ''}</p> : null}
                {notification.sighting ? <p className="mt-1 text-sm text-slate-600">Sighting: {notification.sighting.latitude.toFixed(5)}, {notification.sighting.longitude.toFixed(5)}{notification.sighting.note ? ` · ${notification.sighting.note}` : ''}</p> : null}
                <p className="mt-2 text-xs text-slate-500">UI key: {notification.routeKey} · {notification.createdAt.toLocaleString()}</p>
              </div>
              <form action="/api/notifications/read" method="post" className="grid gap-2">
                <input type="hidden" name="notificationId" value={notification.id} />
                <input type="hidden" name="returnTo" value={notification.href} />
                <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Open</button>
              </form>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
