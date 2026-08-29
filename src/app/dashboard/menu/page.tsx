import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { UI_ROUTES } from '@/lib/uiRoutes';

export const dynamic = 'force-dynamic';

export default async function MenuPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const unread = await prisma.notification.findMany({
    where: { userId: user.id, readAt: null },
    select: { routeKey: true }
  }).catch(() => []);

  const counts = unread.reduce<Record<string, number>>((acc, notification) => {
    acc[notification.routeKey] = (acc[notification.routeKey] ?? 0) + 1;
    return acc;
  }, {});

  const buddyRequests = counts.buddyRequests ?? 0;
  const dogAlerts = (counts.lostDog ?? 0) + (counts.sightings ?? 0);
  const walkInvites = counts.walkInvites ?? 0;
  const messages = counts.messages ?? 0;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-sm font-medium text-slate-500">Buddies Phase 2 Menu</p>
      <h1 className="mt-2 text-3xl font-bold">Menu</h1>
      <p className="mt-2 text-slate-600">Signed in as {user.displayName}. Choose an area below.</p>

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="text-xl font-semibold">Badge breakdown</h2><p className="mt-1 text-sm text-slate-600">The account badge is the unread persistent-notification total.</p></div>
          <span className="rounded-full bg-red-600 px-3 py-1 text-sm font-bold text-white">{unread.length}</span>
        </div>
        <div className="mt-4 grid gap-2 text-sm">
          <Link href={UI_ROUTES.buddyRequests} className="rounded-lg border px-4 py-3">Buddy requests: {buddyRequests}</Link>
          <Link href={UI_ROUTES.messages} className="rounded-lg border px-4 py-3">Messages: {messages}</Link>
          <Link href={UI_ROUTES.alerts} className="rounded-lg border px-4 py-3">Dog alerts: {dogAlerts}</Link>
          <Link href={UI_ROUTES.walkInvites} className="rounded-lg border px-4 py-3">Walk invites: {walkInvites}</Link>
          <Link href={UI_ROUTES.alerts} className="rounded-lg bg-slate-900 px-4 py-3 text-center font-medium text-white">Open notification center</Link>
        </div>
      </section>

      <section className="mt-6 grid gap-3 rounded-2xl border bg-white p-6 shadow-sm">
        <Link href={UI_ROUTES.dashboard} className="rounded-lg border px-4 py-4 font-medium">Dashboard</Link>
        <Link href={UI_ROUTES.profiles} className="rounded-lg border px-4 py-4 font-medium">Profiles</Link>
        <Link href={UI_ROUTES.addProfile} className="rounded-lg border px-4 py-4 font-medium">Add dog</Link>
        <Link href={UI_ROUTES.buddies} className="rounded-lg border px-4 py-4 font-medium">Buddies social graph</Link>
        <Link href={UI_ROUTES.checkIns} className="rounded-lg border px-4 py-4 font-medium">Nearby dog check-ins</Link>
        <Link href={UI_ROUTES.walks} className="rounded-lg border px-4 py-4 font-medium">Walks</Link>
        <Link href={UI_ROUTES.messages} className="rounded-lg border px-4 py-4 font-medium">Messages</Link>
        <Link href={UI_ROUTES.lostReport} className="rounded-lg border px-4 py-4 font-medium">Lost dog mode</Link>
        <Link href={UI_ROUTES.records} className="rounded-lg border px-4 py-4 font-medium">Vet records</Link>
        <Link href={UI_ROUTES.alerts} className="rounded-lg border px-4 py-4 font-medium">Notifications</Link>
        <Link href="/logout" className="rounded-lg bg-red-600 px-4 py-4 text-center font-medium text-white">Sign out</Link>
      </section>
    </main>
  );
}
