import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getReputation, getSocialPrivacy, listConversations, listEvents, listFeed, listGroups } from '@/lib/social/repository';

export const dynamic = 'force-dynamic';

function Card({ title, value, href, description }: { title: string; value: string | number; href: string; description: string }) {
  return (
    <Link href={href} className="rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </Link>
  );
}

export default async function SocialDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const [privacy, conversations, groups, feed, events, reputation] = await Promise.all([
    getSocialPrivacy(user.id),
    listConversations(user.id),
    listGroups(user.id),
    listFeed(user.id),
    listEvents(user.id),
    getReputation(user.id)
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Buddies Social</p>
          <h1 className="text-3xl font-bold text-slate-950">Social hub</h1>
          <p className="mt-2 max-w-2xl text-slate-600">Discover dogs, coordinate walks, message trusted connections, join groups, follow activity, and manage your social privacy.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/buddies" className="rounded-lg border bg-white px-4 py-2">Dog buddies</Link>
          <Link href="/dashboard/check-ins" className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white">Nearby check-ins</Link>
        </div>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card title="Conversations" value={conversations.length} href="/dashboard/messages" description="Direct and walk conversations." />
        <Card title="Groups" value={groups.length} href="/dashboard/buddies" description="Community and dog-interest groups." />
        <Card title="Upcoming events" value={events.length} href="/dashboard/social#events" description="Walks, meetups, and community events." />
        <Card title="Feed items" value={feed.length} href="/dashboard/social#activity" description="Recent activity from you and your buddies." />
        <Card title="Reputation" value={reputation} href="/dashboard/social#trust" description="Trust score from verified social activity." />
        <Card title="Discoverability" value={privacy?.discoverable ? 'On' : 'Off'} href="/dashboard/social#privacy" description="Control how other Buddies members find you." />
      </section>

      <section id="activity" className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Recent activity</h2>
        <div className="mt-4 grid gap-3">
          {feed.length ? feed.slice(0, 10).map((item) => (
            <article key={item.id} className="rounded-xl border p-4">
              <p className="font-medium">{item.type.replaceAll('_', ' ')}</p>
              <p className="mt-1 text-sm text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
            </article>
          )) : <p className="text-sm text-slate-600">Your social feed is ready. Buddy and event activity will appear here.</p>}
        </div>
      </section>

      <section id="events" className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Upcoming events</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {events.length ? events.slice(0, 8).map((event) => (
            <article key={event.id} className="rounded-xl border p-4">
              <h3 className="font-semibold">{event.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{event.locationName ?? 'Location to be announced'}</p>
              <p className="mt-1 text-sm text-slate-500">{new Date(event.startsAt).toLocaleString()}</p>
            </article>
          )) : <p className="text-sm text-slate-600">No upcoming events yet.</p>}
        </div>
      </section>

      <section id="privacy" className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Social privacy</h2>
        <p className="mt-2 text-sm text-slate-600">Privacy is enforced by the Phase 2 social APIs. Current discoverability is <strong>{privacy?.discoverable ? 'enabled' : 'disabled'}</strong>; check-in visibility is <strong>{privacy?.showCheckIns ? 'enabled' : 'disabled'}</strong>.</p>
      </section>

      <section id="trust" className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Trust & moderation</h2>
        <p className="mt-2 text-sm text-slate-600">Reputation is based on persisted reputation events. Social reporting is available through the moderation API and is stored for operational review.</p>
      </section>
    </main>
  );
}
