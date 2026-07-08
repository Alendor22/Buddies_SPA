import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { heatLevel } from '@/lib/socialMap';
import { UI_ROUTES } from '@/lib/uiRoutes';

export const dynamic = 'force-dynamic';

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

export default async function SocialMapPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const now = new Date();
  const userDogs = await prisma.dog.findMany({ where: { ownerId: user.id }, select: { id: true, name: true, slug: true } });
  const userDogIds = userDogs.map((dog) => dog.id);

  const [activeDogs, reports, routes] = await Promise.all([
    prisma.dogPresence.findMany({
      where: { expiresAt: { gt: now } },
      orderBy: { lastHeartbeatAt: 'desc' },
      take: 60,
      include: {
        dog: { select: { id: true, name: true, slug: true, breed: true, photoUrl: true } },
        routeMemory: { select: { name: true, occurrences: true, confidence: true } }
      }
    }),
    prisma.mapReport.findMany({
      where: { expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { dog: { select: { name: true, slug: true } } }
    }),
    prisma.routeMemory.findMany({
      where: { dog: { ownerId: user.id } },
      orderBy: [{ occurrences: 'desc' }, { lastWalkedAt: 'desc' }],
      take: 8,
      include: { dog: { select: { name: true, slug: true } } }
    })
  ]);

  const buddyLinks = userDogIds.length && activeDogs.length
    ? await prisma.dogBuddy.findMany({
        where: {
          OR: activeDogs.flatMap((presence) => userDogIds.flatMap((dogId) => ([
            { dogAId: dogId, dogBId: presence.dogId },
            { dogAId: presence.dogId, dogBId: dogId }
          ])))
        },
        select: { dogAId: true, dogBId: true }
      })
    : [];
  const buddyIds = new Set(buddyLinks.flatMap((link) => [link.dogAId, link.dogBId]));
  const heat = heatLevel(activeDogs.length + reports.length);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Buddies Social Graph / Map</p>
          <h1 className="mt-1 text-3xl font-bold">Neighborhood dog radar</h1>
          <p className="mt-2 max-w-2xl text-slate-600">Waze-style active dogs, buddy halos, route memory, reports, and Snapchat-style heat signals for dog activity.</p>
        </div>
        <div className="flex gap-2">
          <Link href={UI_ROUTES.walks} className="rounded-lg border px-4 py-2 text-sm font-medium">Walks</Link>
          <Link href={UI_ROUTES.createWalk} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Start route</Link>
        </div>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-4">
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Active dogs</p><p className="mt-2 text-3xl font-bold">{activeDogs.length}</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Nearby buddies</p><p className="mt-2 text-3xl font-bold">{activeDogs.filter((presence) => buddyIds.has(presence.dogId)).length}</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Live reports</p><p className="mt-2 text-3xl font-bold">{reports.length}</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Heat level</p><p className="mt-2 text-3xl font-bold capitalize">{heat}</p></article>
      </section>

      <section className="mt-8 overflow-hidden rounded-3xl border bg-slate-950 text-white shadow-sm">
        <div className="relative min-h-[420px] p-6">
          <div className="absolute inset-0 opacity-40" aria-hidden="true">
            <div className="absolute left-[14%] top-[18%] h-40 w-40 animate-pulse rounded-full bg-cyan-300 blur-3xl" />
            <div className="absolute right-[18%] top-[28%] h-52 w-52 animate-pulse rounded-full bg-indigo-300 blur-3xl" />
            <div className="absolute bottom-[14%] left-[38%] h-44 w-44 animate-pulse rounded-full bg-emerald-300 blur-3xl" />
          </div>
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Live activity layer</h2>
              <p className="mt-1 text-sm text-slate-300">Mapbox rendering plugs into this data surface next; markers below already carry avatar, halo, report, and heat metadata.</p>
            </div>
            <span className="rounded-full border border-cyan-200/40 bg-cyan-200/10 px-3 py-1 text-xs font-semibold text-cyan-100">Heat: {heat}</span>
          </div>
          <div className="relative z-10 mt-8 grid gap-4 sm:grid-cols-3">
            {activeDogs.length === 0 ? <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300 sm:col-span-3">No active dog presences yet. Start a walk to create the first live marker.</p> : activeDogs.map((presence, index) => {
              const isBuddy = buddyIds.has(presence.dogId);
              return (
                <Link key={presence.id} href={`/dogs/${presence.dog.slug}`} className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <div className="flex items-center gap-3">
                    <div className={`grid h-12 w-12 place-items-center rounded-full text-sm font-bold ${isBuddy ? 'ring-4 ring-cyan-200 bg-cyan-100 text-slate-900 shadow-[0_0_28px_rgba(125,211,252,0.9)]' : 'bg-white text-slate-900'}`}>{initials(presence.dog.name)}</div>
                    <div>
                      <p className="font-semibold">{presence.dog.name}</p>
                      <p className="text-xs text-slate-300">{presence.status} · score {presence.walkingScore}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-300">DogID avatar {index + 1} · {presence.latitude.toFixed(4)}, {presence.longitude.toFixed(4)}</p>
                  {presence.routeMemory ? <p className="mt-2 text-xs text-cyan-100">Usual route: {presence.routeMemory.name} · {presence.routeMemory.occurrences}x</p> : null}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Waze-style reports</h2>
          <div className="mt-4 grid gap-3">
            {reports.length === 0 ? <p className="text-sm text-slate-600">No live reports yet.</p> : reports.map((report) => (
              <article key={report.id} className="rounded-xl border p-4">
                <p className="text-sm font-semibold">{report.title}</p>
                <p className="mt-1 text-xs text-slate-500">{report.type} · expires {report.expiresAt.toLocaleString()}</p>
                {report.body ? <p className="mt-2 text-sm text-slate-700">{report.body}</p> : null}
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Frequently walked routes</h2>
          <div className="mt-4 grid gap-3">
            {routes.length === 0 ? <p className="text-sm text-slate-600">Route memory starts after repeated saved walks.</p> : routes.map((route) => (
              <article key={route.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{route.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{route.dog.name} · {route.occurrences} walks · confidence {route.confidence}</p>
                  </div>
                  <Link href={`/dogs/${route.dog.slug}`} className="rounded-lg border px-3 py-2 text-xs font-medium">Dog</Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Walking detection model</h2>
        <div className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-3">
          <p className="rounded-xl bg-slate-50 p-4"><strong>Explicit:</strong> Start Walk / End Walk remains the strongest signal.</p>
          <p className="rounded-xl bg-slate-50 p-4"><strong>Passive:</strong> walking speed, movement cadence, route match, geofence, and stale-heartbeat decay.</p>
          <p className="rounded-xl bg-slate-50 p-4"><strong>Safety:</strong> high speed downgrades to possibly driving; stale markers expire automatically.</p>
        </div>
      </section>
    </main>
  );
}
