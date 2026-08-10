import Link from 'next/link';
import { redirect } from 'next/navigation';
import WalkRoutePlanner from '@/components/WalkRoutePlanner';
import UnifiedWalkWorkspace from '@/components/map/UnifiedWalkWorkspace';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { neighborhoodKey } from '@/lib/socialMap';
import { UI_ROUTES } from '@/lib/uiRoutes';
import { parseRoutePlan } from '@/lib/walkRoutes';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function defaultStartTimeValue() {
  const date = new Date(Date.now() + 5 * 60_000);
  date.setSeconds(0, 0);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function parseStartTime(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return new Date(Date.now() + 5 * 60_000);
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? new Date(Date.now() + 5 * 60_000) : parsed;
}

async function createWalkAction(formData: FormData) {
  'use server';

  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const requestedDogId = String(formData.get('dogId') ?? '').trim();
  const startsAtRaw = String(formData.get('startsAt') ?? '').trim();
  const durationMin = Number(formData.get('durationMin') ?? 30);
  const notes = String(formData.get('notes') ?? '').trim().slice(0, 1000);
  const routeName = String(formData.get('routeName') ?? '').trim().slice(0, 120);
  const routePlan = parseRoutePlan(String(formData.get('routeJson') ?? '').trim());
  const startsAt = parseStartTime(startsAtRaw);
  const earliestAllowed = Date.now() - 5 * 60_000;

  const dog = await prisma.dog.findFirst({
    where: requestedDogId ? { id: requestedDogId, ownerId: user.id } : { ownerId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true }
  });

  if (!dog) redirect(`${UI_ROUTES.createWalk}?error=dog`);
  if (startsAt.getTime() < earliestAllowed || !Number.isFinite(durationMin)) {
    redirect(`${UI_ROUTES.createWalk}?error=time`);
  }

  await prisma.walk.create({
    data: {
      dogId: dog.id,
      requesterId: user.id,
      startsAt,
      durationMin: Math.max(10, Math.min(240, Math.round(durationMin))),
      notes: notes || null,
      routeName: routePlan.name || routeName || null,
      routeEngine: routePlan.routeEngine,
      routeGeometry: routePlan.routeGeometry,
      routeSteps: routePlan.routeSteps,
      routeDistanceMiles: routePlan.routeDistanceMiles,
      routeDurationMin: routePlan.routeDurationMin
    }
  });

  redirect(`${UI_ROUTES.walks}?created=1`);
}

export default async function NewWalkPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');
  const { error } = await searchParams;
  const now = new Date();
  const heatCutoff = new Date(now.getTime() - 15 * 60_000);

  const [dogs, activeDogsRaw, reportsRaw, memoriesRaw] = await Promise.all([
    prisma.dog.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, breed: true }
    }),
    prisma.dogPresence.findMany({
      where: { expiresAt: { gt: now }, lastHeartbeatAt: { gte: heatCutoff } },
      orderBy: { lastHeartbeatAt: 'desc' },
      take: 100,
      include: { dog: { select: { id: true, name: true, slug: true, breed: true } } }
    }),
    prisma.mapReport.findMany({
      where: { expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, title: true, type: true, latitude: true, longitude: true }
    }),
    prisma.routeMemory.findMany({
      where: { dog: { ownerId: user.id } },
      orderBy: [{ occurrences: 'desc' }, { lastWalkedAt: 'desc' }],
      take: 8,
      include: { dog: { select: { name: true } } }
    })
  ]);

  const userDogIds = dogs.map((dog) => dog.id);
  const activeDogIds = activeDogsRaw.map((presence) => presence.dogId);
  const buddyLinks = userDogIds.length && activeDogIds.length
    ? await prisma.dogBuddy.findMany({
        where: {
          OR: [
            { dogAId: { in: userDogIds }, dogBId: { in: activeDogIds } },
            { dogAId: { in: activeDogIds }, dogBId: { in: userDogIds } }
          ]
        },
        select: { dogAId: true, dogBId: true }
      })
    : [];
  const buddyIds = new Set(buddyLinks.flatMap((link) => [link.dogAId, link.dogBId]));

  const activeDogs = activeDogsRaw.map((presence) => ({
    id: presence.id,
    dogName: presence.dog.name,
    dogSlug: presence.dog.slug,
    avatar: presence.dog.name.slice(0, 2).toUpperCase(),
    breed: presence.dog.breed,
    status: presence.status,
    walkingScore: presence.walkingScore,
    isBuddy: buddyIds.has(presence.dogId),
    device_loc: {
      lat: presence.latitude,
      lng: presence.longitude,
      accuracyMeters: presence.accuracyMeters,
      speedMph: presence.speedMph,
      heading: presence.heading,
      altitude: null,
      timestamp: presence.lastHeartbeatAt.toISOString()
    }
  }));

  const heatCells = Array.from(activeDogsRaw.reduce((cells, presence) => {
    const key = neighborhoodKey(presence.latitude, presence.longitude);
    const [latitude, longitude] = key.split(',').map(Number);
    const ageMinutes = Math.max(0, (now.getTime() - presence.lastHeartbeatAt.getTime()) / 60_000);
    const recencyWeight = Math.max(0.05, 1 - ageMinutes / 15);
    const confidenceWeight = Math.max(0.1, Math.min(1, presence.walkingScore / 100));
    const current = cells.get(key) ?? {
      key,
      latitude,
      longitude,
      activeDogs: 0,
      buddies: 0,
      weight: 0
    };
    current.activeDogs += 1;
    if (buddyIds.has(presence.dogId)) current.buddies += 1;
    current.weight = Math.min(1, current.weight + recencyWeight * confidenceWeight);
    cells.set(key, current);
    return cells;
  }, new Map<string, {
    key: string;
    latitude: number;
    longitude: number;
    activeDogs: number;
    buddies: number;
    weight: number;
  }>()).values());

  const reports = reportsRaw.map((report) => ({
    id: report.id,
    title: report.title,
    type: report.type,
    latitude: report.latitude,
    longitude: report.longitude
  }));

  const routeMemories = memoriesRaw.map((route) => ({
    id: route.id,
    name: route.name,
    dogName: route.dog.name,
    occurrences: route.occurrences,
    confidence: route.confidence
  }));

  const errorMessage = error === 'dog'
    ? 'Unable to create the walk. Select one of your dog profiles.'
    : error === 'time'
      ? 'Unable to create the walk. Enter a current or future start time.'
      : error
        ? 'Unable to create the walk. Confirm the dog profile and start time, then retry.'
        : null;

  if (dogs.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold">No profiles yet</h1>
          <p className="mt-2 text-slate-600">Create a dog profile before creating a walk.</p>
          <Link href={UI_ROUTES.addProfile} className="mt-5 inline-block rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Add Profile</Link>
        </section>
      </main>
    );
  }

  const walkDetails = (
    <section className="grid gap-4 text-slate-950">
      {errorMessage ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMessage}</div> : null}
      <label className="grid gap-2 text-sm font-medium text-white">Dog profile
        <select name="dogId" required defaultValue={dogs[0]?.id} className="rounded-lg border bg-white/90 px-3 py-3 text-base text-slate-950">
          {dogs.map((dog) => <option key={dog.id} value={dog.id}>{dog.name}{dog.breed ? ` · ${dog.breed}` : ''}</option>)}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-medium text-white">Start time
        <input name="startsAt" type="datetime-local" required defaultValue={defaultStartTimeValue()} className="rounded-lg border bg-white/90 px-3 py-3 text-base text-slate-950" />
      </label>
      <label className="grid gap-2 text-sm font-medium text-white">Duration
        <select name="durationMin" defaultValue="30" className="rounded-lg border bg-white/90 px-3 py-3 text-base text-slate-950">
          <option value="15">15 minutes</option>
          <option value="30">30 minutes</option>
          <option value="45">45 minutes</option>
          <option value="60">60 minutes</option>
          <option value="90">90 minutes</option>
        </select>
      </label>
      <label className="grid gap-2 text-sm font-medium text-white">Notes
        <textarea name="notes" rows={4} maxLength={1000} placeholder="Optional pickup, schedule, or temperament notes" className="rounded-lg border bg-white/90 px-3 py-3 text-base text-slate-950" />
      </label>
    </section>
  );

  const actions = (
    <div className="grid gap-2">
      <button className="rounded-lg bg-white px-5 py-3 font-medium text-slate-950">Create walk</button>
      <Link href={UI_ROUTES.walks} className="rounded-lg border border-white/30 px-5 py-3 text-center font-medium text-white">Back to Walks</Link>
    </div>
  );

  return (
    <form action={createWalkAction}>
      <UnifiedWalkWorkspace
        planner={(
          <WalkRoutePlanner
            activeDogs={activeDogs}
            heatCells={heatCells}
            reports={reports}
          />
        )}
        walkDetails={walkDetails}
        actions={actions}
        activeDogs={activeDogs}
        heatCells={heatCells}
        reports={reports}
        routeMemories={routeMemories}
      />
    </form>
  );
}
