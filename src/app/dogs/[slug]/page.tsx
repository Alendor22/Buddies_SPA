import Link from 'next/link';
import { notFound } from 'next/navigation';
import DogWalkInvitations from '@/components/DogWalkInvitations';
import LostDogMap from '@/components/LostDogMap';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

function ageLabel(birthDate: Date | null) {
  if (!birthDate) return 'Not provided';
  const now = new Date();
  let years = now.getFullYear() - birthDate.getFullYear();
  const monthDelta = now.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birthDate.getDate())) years -= 1;
  return years > 0 ? `${years} year${years === 1 ? '' : 's'} old` : 'Under 1 year old';
}

export default async function DogProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  const { slug } = await params;

  const dog = await prisma.dog.findUnique({
    where: { slug },
    select: {
      id: true,
      ownerId: true,
      publicId: true,
      slug: true,
      name: true,
      breed: true,
      status: true,
      photoUrl: true,
      birthDate: true,
      weightLbs: true,
      gender: true,
      temperament: true,
      medicalNotes: true,
      vaccinationNotes: true,
      emergencyContact: true,
      lostSince: true,
      lastSeenLocation: true,
      lostReward: true,
      lostNotes: true,
      latitude: true,
      longitude: true,
      spayedNeutered: true,
      friendlyDogs: true,
      friendlyCats: true,
      friendlyChildren: true,
      sightings: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, note: true, latitude: true, longitude: true, createdAt: true }
      },
      owner: { select: { displayName: true } }
    }
  });

  if (!dog) notFound();

  const isSafe = dog.status === 'SAFE';
  const isOwner = Boolean(user && dog.ownerId === user.id);
  const publicUrl = `https://buddies.vercel.app/dogs/${dog.slug}`;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href="/dogs" className="text-sm font-medium underline">All profiles</Link>
        <div className="flex gap-2">
          {isOwner ? <Link href={`/dogs/edit?slug=${dog.slug}`} className="rounded-lg border px-4 py-2">Edit</Link> : null}
          <Link href={`/dogs/${dog.slug}/qr`} className="rounded-lg border px-4 py-2">QR page</Link>
          <Link href="/dashboard" className="rounded-lg border px-4 py-2">Dashboard</Link>
        </div>
      </div>

      <article className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className={`px-6 py-4 text-sm font-semibold ${isSafe ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>Safety status: {dog.status}</div>
        {dog.photoUrl ? <img src={dog.photoUrl} alt={`${dog.name} profile`} className="h-72 w-full object-cover" /> : <div className="flex h-72 items-center justify-center bg-slate-100 text-slate-500">No profile photo yet</div>}

        <div className="p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Public dog ID · {dog.publicId ?? dog.id}</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div><h1 className="text-4xl font-bold">{dog.name}</h1><p className="mt-2 text-slate-600">{dog.breed ?? 'Breed not listed'} · Owner: {dog.owner.displayName}</p></div>
            <Link href={`/dogs/${dog.slug}/qr`} className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Show QR Code</Link>
          </div>

          {!isSafe ? (
            <section id="lost-dog" className="mt-6 scroll-mt-24 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
              <h2 className="font-semibold">Lost dog alert</h2>
              <p className="mt-2 text-sm">{dog.name} is not currently marked SAFE. Submit a sighting if you have relevant information.</p>
              <div className="mt-3 grid gap-2 text-sm">
                <p><strong>Last seen:</strong> {dog.lastSeenLocation ?? 'Not provided'}</p>
                <p><strong>Lost since:</strong> {dog.lostSince ? dog.lostSince.toLocaleString() : 'Not provided'}</p>
                <p><strong>Reward/contact note:</strong> {dog.lostReward ?? 'Not provided'}</p>
                <p><strong>Notes:</strong> {dog.lostNotes ?? 'No notes provided'}</p>
              </div>
              <LostDogMap name={dog.name} lastSeenLocation={dog.lastSeenLocation} latitude={dog.latitude} longitude={dog.longitude} sightings={dog.sightings} />
              <Link href={`/dogs/${dog.slug}/sighting`} className="mt-4 inline-block rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white">Report sighting</Link>
            </section>
          ) : null}

          <section className="mt-7 grid gap-4 sm:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase text-slate-500">Age</p><p className="mt-1 font-medium">{ageLabel(dog.birthDate)}</p></div>
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase text-slate-500">Weight</p><p className="mt-1 font-medium">{dog.weightLbs ? `${dog.weightLbs} lb` : 'Not provided'}</p></div>
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase text-slate-500">Gender</p><p className="mt-1 font-medium">{dog.gender ?? 'Not provided'}</p></div>
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase text-slate-500">Fixed</p><p className="mt-1 font-medium">{dog.spayedNeutered ? 'Yes' : 'No / unknown'}</p></div>
          </section>

          <section className="mt-7 grid gap-4 rounded-xl border p-4">
            <div><h2 className="font-semibold">Temperament</h2><p className="mt-1 text-slate-600">{dog.temperament ?? 'Not provided'}</p></div>
            <div><h2 className="font-semibold">Vaccination notes</h2><p className="mt-1 text-slate-600">{dog.vaccinationNotes ?? 'Not provided'}</p></div>
            <div><h2 className="font-semibold">Medical notes</h2><p className="mt-1 text-slate-600">{dog.medicalNotes ?? 'None provided'}</p></div>
            <div><h2 className="font-semibold">Emergency contact</h2><p className="mt-1 text-slate-600">{dog.emergencyContact ?? 'Not provided'}</p></div>
          </section>

          <DogWalkInvitations dogId={dog.id} dogName={dog.name} isOwner={isOwner} />

          <section className="mt-7 rounded-xl border p-4">
            <h2 className="font-semibold">Recent sightings</h2>
            <div className="mt-3 grid gap-2 text-sm text-slate-700">
              {dog.sightings.length === 0 ? <p>No sightings reported.</p> : dog.sightings.map((sighting) => <article key={sighting.id} className="rounded-lg bg-slate-50 p-3"><p className="font-medium">{sighting.latitude}, {sighting.longitude}</p><p>{sighting.note ?? 'No note provided'}</p><p className="text-xs text-slate-500">{sighting.createdAt.toLocaleString()}</p></article>)}
            </div>
          </section>

          <section className="mt-7 rounded-xl border p-4"><h2 className="font-semibold">Share this safety profile</h2><p className="mt-2 break-all text-sm text-slate-600">{publicUrl}</p></section>
        </div>
      </article>
    </main>
  );
}
