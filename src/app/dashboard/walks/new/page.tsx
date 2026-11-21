import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { UI_ROUTES } from '@/lib/uiRoutes';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function defaultStartTimeValue() {
  const date = new Date(Date.now() + 5 * 60_000);
  date.setSeconds(0, 0);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

async function createWalkAction(formData: FormData) {
  'use server';

  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const requestedDogId = String(formData.get('dogId') ?? '').trim();
  const startsAtRaw = String(formData.get('startsAt') ?? '').trim();
  const crossStreet = String(formData.get('crossStreet') ?? '').trim().slice(0, 120);
  const durationMin = Number(formData.get('durationMin') ?? 30);
  const notes = String(formData.get('notes') ?? '').trim().slice(0, 1000);
  const startsAt = startsAtRaw ? new Date(startsAtRaw) : new Date(Number.NaN);

  const dog = await prisma.dog.findFirst({
    where: requestedDogId ? { id: requestedDogId, ownerId: user.id } : { ownerId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true }
  });

  if (!dog) redirect(`${UI_ROUTES.createWalk}?error=dog`);
  if (!crossStreet) redirect(`${UI_ROUTES.createWalk}?error=location`);
  if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() < Date.now() - 5 * 60_000 || !Number.isFinite(durationMin)) {
    redirect(`${UI_ROUTES.createWalk}?error=time`);
  }

  await prisma.walk.create({
    data: {
      dogId: dog.id,
      requesterId: user.id,
      startsAt,
      durationMin: Math.max(10, Math.min(240, Math.round(durationMin))),
      notes: notes || null,
      routeName: crossStreet,
      routeEngine: null,
      routeGeometry: null,
      routeSteps: null,
      routeDistanceMiles: null,
      routeDurationMin: null
    }
  });

  redirect(`${UI_ROUTES.walks}?created=1`);
}

export default async function NewWalkPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');
  const { error } = await searchParams;
  const dogs = await prisma.dog.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, breed: true }
  });

  if (dogs.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold">No profiles yet</h1>
          <p className="mt-2 text-slate-600">Create a dog profile before planning a walk.</p>
          <Link href={UI_ROUTES.addProfile} className="mt-5 inline-block rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Add profile</Link>
        </section>
      </main>
    );
  }

  const errorMessage = error === 'dog'
    ? 'Select one of your dog profiles.'
    : error === 'location'
      ? 'Enter the cross streets where you plan to meet.'
      : error === 'time'
        ? 'Enter a valid current or future start time and duration.'
        : error ? 'The walk could not be created. Review the details and try again.' : null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <section className="rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-medium text-slate-500">Walks</p>
        <h1 className="mt-1 text-3xl font-bold">Plan a walk</h1>
        <p className="mt-2 text-slate-600">Set a meeting point by cross street. You can coordinate the route with participants in the walk chat.</p>
        {errorMessage ? <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMessage}</div> : null}

        <form action={createWalkAction} className="mt-6 grid gap-5">
          <label className="grid gap-2 text-sm font-semibold">Dog profile
            <select name="dogId" required defaultValue={dogs[0]?.id} className="rounded-lg border px-3 py-3 text-base font-normal">
              {dogs.map((dog) => <option key={dog.id} value={dog.id}>{dog.name}{dog.breed ? ` · ${dog.breed}` : ''}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold">Meeting cross streets
            <input name="crossStreet" required maxLength={120} autoComplete="street-address" placeholder="Example: Broad St & Market St, Newark" className="rounded-lg border px-3 py-3 text-base font-normal" />
            <span className="text-xs font-normal text-slate-500">Enter the intersection participants should meet at. A route map is not needed to create the walk.</span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold">Start time
              <input name="startsAt" type="datetime-local" required defaultValue={defaultStartTimeValue()} className="rounded-lg border px-3 py-3 text-base font-normal" />
            </label>
            <label className="grid gap-2 text-sm font-semibold">Duration
              <select name="durationMin" defaultValue="30" className="rounded-lg border px-3 py-3 text-base font-normal">
                <option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option><option value="90">90 minutes</option>
              </select>
            </label>
          </div>
          <label className="grid gap-2 text-sm font-semibold">Notes <span className="font-normal text-slate-500">Optional</span>
            <textarea name="notes" rows={3} maxLength={1000} placeholder="Anything participants should know" className="rounded-lg border px-3 py-3 text-base font-normal" />
          </label>
          <div className="flex flex-wrap gap-3 pt-1">
            <button className="rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white">Create walk</button>
            <Link href={UI_ROUTES.walks} className="rounded-lg border px-5 py-3 text-center font-medium">Back to walks</Link>
          </div>
        </form>
      </section>
    </main>
  );
}
