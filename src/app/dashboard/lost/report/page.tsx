import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DogStatus, NotificationType } from '@prisma/client';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { dogLostRoute, dogProfileRoute, UI_ROUTES } from '@/lib/uiRoutes';

export const dynamic = 'force-dynamic';

function optionalNumber(value: FormDataEntryValue | null, min: number, max: number) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

async function reportLostAction(formData: FormData) {
  'use server';
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const dogId = String(formData.get('dogId') ?? '').trim();
  const lastSeenLocation = String(formData.get('lastSeenLocation') ?? '').trim() || null;
  const lostReward = String(formData.get('lostReward') ?? '').trim() || null;
  const lostNotes = String(formData.get('lostNotes') ?? '').trim() || null;
  const latitude = optionalNumber(formData.get('latitude'), -90, 90);
  const longitude = optionalNumber(formData.get('longitude'), -180, 180);

  const dog = await prisma.dog.findFirst({ where: { id: dogId, ownerId: user.id }, select: { id: true, slug: true, name: true } });
  if (!dog) redirect(`${UI_ROUTES.lostReport}?error=dog`);

  await prisma.$transaction(async (tx) => {
    await tx.dog.update({
      where: { id: dog.id },
      data: { status: DogStatus.LOST, lostSince: new Date(), lastSeenLocation, lostReward, lostNotes, latitude, longitude }
    });
    await tx.notification.updateMany({
      where: { userId: user.id, dogId: dog.id, type: { in: [NotificationType.DOG_LOST, NotificationType.DOG_FOUND] }, readAt: null },
      data: { readAt: new Date() }
    });
    await tx.notification.create({
      data: {
        userId: user.id,
        type: NotificationType.DOG_LOST,
        routeKey: 'lostDog',
        href: dogLostRoute(dog.slug),
        title: `${dog.name} is marked lost`,
        body: lastSeenLocation ? `Last seen: ${lastSeenLocation}` : 'Open the profile to complete the recovery details.',
        dogId: dog.id
      }
    });
  });

  redirect(`${dogLostRoute(dog.slug)}?lost=1`);
}

async function markSafeAction(formData: FormData) {
  'use server';
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');
  const dogId = String(formData.get('dogId') ?? '').trim();
  const dog = await prisma.dog.findFirst({ where: { id: dogId, ownerId: user.id }, select: { id: true, slug: true, name: true } });
  if (!dog) redirect(`${UI_ROUTES.lostReport}?error=dog`);

  await prisma.$transaction(async (tx) => {
    await tx.dog.update({ where: { id: dog.id }, data: { status: DogStatus.SAFE, lostSince: null, lastSeenLocation: null, lostReward: null, lostNotes: null } });
    await tx.notification.updateMany({ where: { userId: user.id, dogId: dog.id, readAt: null }, data: { readAt: new Date() } });
    await tx.notification.create({
      data: {
        userId: user.id,
        type: NotificationType.DOG_FOUND,
        routeKey: 'lostDog',
        href: dogProfileRoute(dog.slug),
        title: `${dog.name} is marked safe`,
        body: 'The active lost-dog alert has been cleared.',
        dogId: dog.id
      }
    });
  });

  redirect(`${dogProfileRoute(dog.slug)}?safe=1`);
}

export default async function ReportLostPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');
  const { error } = await searchParams;

  const dogs = await prisma.dog.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, breed: true, status: true, slug: true }
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="text-sm font-medium text-slate-500">Buddies Phase 1 Lost Dog Network</p>
      <h1 className="mt-2 text-3xl font-bold">Report lost dog</h1>
      <p className="mt-2 text-slate-600">Mark a dog as LOST, publish its QR safety status, pin the recovery flag, and create a persistent notification.</p>

      {error ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Select one of your own dog profiles.</div> : null}

      {dogs.length === 0 ? (
        <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">No dog profiles</h2><p className="mt-2 text-slate-600">Create a profile before using lost dog mode.</p><Link href={UI_ROUTES.addProfile} className="mt-5 inline-block rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Add Profile</Link></section>
      ) : (
        <section className="mt-8 grid gap-5">
          <form action={reportLostAction} className="grid gap-4 rounded-2xl border bg-white p-6 shadow-sm">
            <label className="grid gap-2 text-sm font-medium">Dog profile<select name="dogId" required className="rounded-lg border px-3 py-3 text-base">{dogs.map((dog) => <option key={dog.id} value={dog.id}>{dog.name}{dog.breed ? ` · ${dog.breed}` : ''} · {dog.status}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-medium">Last seen location<input name="lastSeenLocation" placeholder="Street, park, cross streets, or neighborhood" className="rounded-lg border px-3 py-3 text-base" /></label>
            <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-2 text-sm font-medium">Latitude<input name="latitude" inputMode="decimal" placeholder="40.685743" className="rounded-lg border px-3 py-3 text-base" /></label><label className="grid gap-2 text-sm font-medium">Longitude<input name="longitude" inputMode="decimal" placeholder="-73.941329" className="rounded-lg border px-3 py-3 text-base" /></label></div>
            <p className="text-xs text-slate-500">Coordinates are optional. Blank fields remain blank instead of being stored as 0,0.</p>
            <label className="grid gap-2 text-sm font-medium">Reward<input name="lostReward" placeholder="Optional reward or contact instruction" className="rounded-lg border px-3 py-3 text-base" /></label>
            <label className="grid gap-2 text-sm font-medium">Notes<textarea name="lostNotes" rows={4} placeholder="Collar, temperament, direction last seen, safety instructions" className="rounded-lg border px-3 py-3 text-base" /></label>
            <button className="rounded-lg bg-red-600 px-5 py-3 font-medium text-white">Activate lost dog alert</button>
          </form>

          <form action={markSafeAction} className="grid gap-3 rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Mark safe</h2>
            <select name="dogId" required className="rounded-lg border px-3 py-3 text-base">{dogs.map((dog) => <option key={dog.id} value={dog.id}>{dog.name} · {dog.status}</option>)}</select>
            <button className="rounded-lg border px-5 py-3 font-medium">Clear lost status</button>
          </form>
        </section>
      )}
    </main>
  );
}
