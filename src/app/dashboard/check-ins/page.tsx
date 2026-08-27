import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import CheckInMapClient from '@/components/CheckInMapClient';
import DogCheckInForm from '@/components/DogCheckInForm';
import { getCurrentUser } from '@/lib/auth';
import { checkInsAvailable, getCheckIn, listActiveCheckIns, removeCheckIn } from '@/lib/checkIns';
import { prisma } from '@/lib/db';
import { getPublicMapboxToken } from '@/lib/mapboxToken';
import { UI_ROUTES } from '@/lib/uiRoutes';

export const dynamic = 'force-dynamic';

async function endCheckInAction(formData: FormData) {
  'use server';

  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const dogId = String(formData.get('dogId') ?? '').trim();
  if (!dogId) redirect('/dashboard/check-ins?error=dog');

  const current = await getCheckIn(dogId);
  if (!current || current.ownerId !== user.id) redirect('/dashboard/check-ins?error=check-in');

  await removeCheckIn(dogId);
  redirect('/dashboard/check-ins?ended=1');
}

export default async function CheckInsPage({ searchParams }: { searchParams: Promise<{ ended?: string; error?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const params = await searchParams;
  const [dogs, profile, activeRecords] = await Promise.all([
    prisma.dog.findMany({
      where: { ownerId: user.id, status: 'SAFE' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true }
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { latitude: true, longitude: true }
    }),
    listActiveCheckIns()
  ]);

  const dogIds = activeRecords.map((record) => record.dogId);
  const activeDogs = dogIds.length
    ? await prisma.dog.findMany({
        where: { id: { in: dogIds }, status: 'SAFE' },
        select: { id: true, name: true, slug: true, breed: true, photoUrl: true }
      })
    : [];
  const dogById = new Map(activeDogs.map((dog) => [dog.id, dog]));

  const checkIns = activeRecords.flatMap((record) => {
    const dog = dogById.get(record.dogId);
    return dog ? [{ ...record, dog }] : [];
  });

  const centerLatitude = checkIns[0]?.latitude ?? profile?.latitude ?? 40.685743;
  const centerLongitude = checkIns[0]?.longitude ?? profile?.longitude ?? -73.941329;
  const mapToken = getPublicMapboxToken();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Buddies Phase 2 Nearby Activity</p>
          <h1 className="mt-1 text-3xl font-bold">Dog check-ins</h1>
          <p className="mt-2 text-slate-600">Publish expiring dog-first locations and discover active dogs nearby without exposing owner identity.</p>
        </div>
        <div className="flex gap-2">
          <Link href={UI_ROUTES.buddies} className="rounded-lg border px-4 py-2">Buddies</Link>
          <Link href={UI_ROUTES.dashboard} className="rounded-lg border px-4 py-2">Dashboard</Link>
        </div>
      </div>

      {params.ended ? <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">Dog check-in ended.</div> : null}
      {params.error ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">The check-in could not be updated.</div> : null}
      {!checkInsAvailable() ? <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Nearby check-ins require the Upstash Redis environment variables in Vercel.</div> : null}

      <section className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
        <DogCheckInForm dogs={dogs} />
        <CheckInMapClient
          token={mapToken}
          centerLatitude={centerLatitude}
          centerLongitude={centerLongitude}
          points={checkIns.map((checkIn) => ({
            id: checkIn.dog.id,
            name: `${checkIn.dog.name} · ${checkIn.placeName}`,
            latitude: checkIn.latitude,
            longitude: checkIn.longitude
          }))}
        />
      </section>

      <section className="mt-8">
        <div className="flex items-end justify-between gap-3">
          <div><h2 className="text-2xl font-semibold">Active nearby dogs</h2><p className="mt-1 text-slate-600">{checkIns.length} active check-in{checkIns.length === 1 ? '' : 's'}</p></div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {checkIns.length === 0 ? (
            <div className="rounded-2xl border bg-white p-6 shadow-sm md:col-span-2 lg:col-span-3">
              <h3 className="text-xl font-semibold">No active dog check-ins</h3>
              <p className="mt-2 text-slate-600">Publish the first neighborhood check-in to start local activity.</p>
            </div>
          ) : checkIns.map((checkIn) => (
            <article key={checkIn.dog.id} className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex gap-3">
                {checkIn.dog.photoUrl ? <Image src={checkIn.dog.photoUrl} alt={`${checkIn.dog.name} profile`} width={56} height={56} unoptimized className="h-14 w-14 shrink-0 rounded-full object-cover" /> : <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-900 text-2xl text-white">🐶</div>}
                <div className="min-w-0"><h3 className="font-semibold">{checkIn.dog.name}</h3><p className="text-sm text-slate-600">{checkIn.dog.breed ?? 'Breed not listed'}</p><p className="text-xs text-slate-500">Owner hidden</p></div>
              </div>
              <p className="mt-4 font-medium">{checkIn.placeName}</p>
              {checkIn.note ? <p className="mt-1 text-sm text-slate-700">{checkIn.note}</p> : null}
              <p className="mt-2 text-xs text-slate-500">Expires {new Date(checkIn.expiresAt).toLocaleString()}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/dogs/${checkIn.dog.slug}`} className="rounded-lg border px-3 py-2 text-sm font-medium">Dog profile</Link>
                <a href={`https://www.openstreetmap.org/?mlat=${checkIn.latitude}&mlon=${checkIn.longitude}#map=16/${checkIn.latitude}/${checkIn.longitude}`} target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-2 text-sm font-medium">Open map</a>
                {checkIn.ownerId === user.id ? <form action={endCheckInAction}><input type="hidden" name="dogId" value={checkIn.dog.id} /><button className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700">End check-in</button></form> : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
