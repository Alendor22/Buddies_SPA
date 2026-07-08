import Link from 'next/link';
import { redirect } from 'next/navigation';
import WalkRoutePlanner from '@/components/WalkRoutePlanner';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getPublicMapboxToken } from '@/lib/mapboxToken';
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

export default async function NewWalkPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');
  const { error } = await searchParams;

  const [dogs, mapboxToken] = await Promise.all([
    prisma.dog.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, breed: true }
    }),
    Promise.resolve(getPublicMapboxToken())
  ]);

  const errorMessage = error === 'dog'
    ? 'Unable to create the walk. Select one of your dog profiles.'
    : error === 'time'
      ? 'Unable to create the walk. Enter a current or future start time.'
      : error
        ? 'Unable to create the walk. Confirm the dog profile and start time, then retry.'
        : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-sm font-medium text-slate-500">Buddies Phase 2 Walk Composer</p>
      <h1 className="mt-2 text-3xl font-bold">Create walk</h1>
      <p className="mt-2 text-slate-600">Generate a route snapped to walking streets and save its geometry, directions, distance, and duration.</p>

      {errorMessage ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMessage}</div> : null}

      {dogs.length === 0 ? (
        <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">No profiles yet</h2>
          <p className="mt-2 text-slate-600">Create a dog profile before creating a walk.</p>
          <Link href={UI_ROUTES.addProfile} className="mt-5 inline-block rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Add Profile</Link>
        </section>
      ) : (
        <form action={createWalkAction} className="mt-8 grid gap-5">
          <section className="grid gap-4 rounded-2xl border bg-white p-6 shadow-sm">
            <label className="grid gap-2 text-sm font-medium">Dog profile<select name="dogId" required defaultValue={dogs[0]?.id} className="rounded-lg border px-3 py-3 text-base">{dogs.map((dog) => <option key={dog.id} value={dog.id}>{dog.name}{dog.breed ? ` · ${dog.breed}` : ''}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-medium">Start time<input name="startsAt" type="datetime-local" required defaultValue={defaultStartTimeValue()} className="rounded-lg border px-3 py-3 text-base" /></label>
            <label className="grid gap-2 text-sm font-medium">Duration<select name="durationMin" defaultValue="30" className="rounded-lg border px-3 py-3 text-base"><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option><option value="90">90 minutes</option></select></label>
            <label className="grid gap-2 text-sm font-medium">Notes<textarea name="notes" rows={4} maxLength={1000} placeholder="Optional pickup, schedule, or temperament notes" className="rounded-lg border px-3 py-3 text-base" /></label>
          </section>

          <WalkRoutePlanner initialToken={mapboxToken} />

          <button className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Create walk</button>
          <Link href={UI_ROUTES.walks} className="rounded-lg border px-5 py-3 text-center font-medium">Back to Walks</Link>
        </form>
      )}
    </main>
  );
}
