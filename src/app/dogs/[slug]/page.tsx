import Link from 'next/link';
import { notFound } from 'next/navigation';
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
  const dog = slug === 'demo' ? null : await prisma.dog.findUnique({
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
      spayedNeutered: true,
      friendlyDogs: true,
      friendlyCats: true,
      friendlyChildren: true,
      owner: { select: { displayName: true } }
    }
  });

  if (!dog && slug !== 'demo') notFound();

  const profile = dog ?? {
    id: 'demo', ownerId: '', publicId: 'demo-buddy', slug: 'demo', name: 'Buddy', breed: 'Mixed breed', status: 'SAFE', photoUrl: null, birthDate: null, weightLbs: null, gender: null,
    temperament: 'Friendly and calm around people.', medicalNotes: 'No known allergies', vaccinationNotes: 'Vaccinations current', emergencyContact: '(555) 010-2026',
    spayedNeutered: true, friendlyDogs: true, friendlyCats: false, friendlyChildren: true, owner: { displayName: 'Demo Owner' }
  };

  const publicUrl = `https://buddies.vercel.app/dogs/${profile.slug}`;
  const isSafe = profile.status === 'SAFE';
  const isOwner = Boolean(user && profile.ownerId === user.id);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href="/dogs" className="text-sm font-medium underline">All dogs</Link>
        <div className="flex gap-2">
          {isOwner ? <Link href={`/dogs/edit?slug=${profile.slug}`} className="rounded-lg border px-4 py-2">Edit</Link> : null}
          <Link href={`/dogs/${profile.slug}/qr`} className="rounded-lg border px-4 py-2">QR page</Link>
          <Link href="/dashboard" className="rounded-lg border px-4 py-2">Dashboard</Link>
        </div>
      </div>

      <article className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className={`px-6 py-4 text-sm font-semibold ${isSafe ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>Safety status: {profile.status}</div>
        {profile.photoUrl ? <img src={profile.photoUrl} alt={`${profile.name} profile`} className="h-72 w-full object-cover" /> : <div className="flex h-72 items-center justify-center bg-slate-100 text-slate-500">No profile photo yet</div>}
        <div className="p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Public dog ID · {profile.publicId ?? profile.id}</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div><h1 className="text-4xl font-bold">{profile.name}</h1><p className="mt-2 text-slate-600">{profile.breed ?? 'Breed not listed'} · Owner: {profile.owner.displayName}</p></div>
            <Link href={`/dogs/${profile.slug}/qr`} className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Show QR Code</Link>
          </div>
          {!isSafe ? <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900"><h2 className="font-semibold">Safety notice</h2><p className="mt-2 text-sm">This profile is not currently marked SAFE. Use the emergency contact below if you have relevant information.</p></section> : null}
          <section className="mt-7 grid gap-4 sm:grid-cols-4"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase text-slate-500">Age</p><p className="mt-1 font-medium">{ageLabel(profile.birthDate)}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase text-slate-500">Weight</p><p className="mt-1 font-medium">{profile.weightLbs ? `${profile.weightLbs} lb` : 'Not provided'}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase text-slate-500">Gender</p><p className="mt-1 font-medium">{profile.gender ?? 'Not provided'}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase text-slate-500">Fixed</p><p className="mt-1 font-medium">{profile.spayedNeutered ? 'Yes' : 'No / unknown'}</p></div></section>
          <dl className="mt-7 grid gap-5"><div><dt className="font-semibold">Temperament</dt><dd className="mt-1 text-slate-600">{profile.temperament ?? 'Not provided'}</dd></div><div><dt className="font-semibold">Vaccination notes</dt><dd className="mt-1 text-slate-600">{profile.vaccinationNotes ?? 'Not provided'}</dd></div><div><dt className="font-semibold">Medical notes</dt><dd className="mt-1 text-slate-600">{profile.medicalNotes ?? 'None provided'}</dd></div><div><dt className="font-semibold">Emergency contact</dt><dd className="mt-1 text-slate-600">{profile.emergencyContact ?? 'Not provided'}</dd></div></dl>
          <section className="mt-7 rounded-xl bg-slate-50 p-4"><h2 className="font-semibold">Compatibility</h2><div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-3"><p className="rounded-lg bg-white p-3">Dogs: {profile.friendlyDogs ? 'Yes' : 'No / unknown'}</p><p className="rounded-lg bg-white p-3">Cats: {profile.friendlyCats ? 'Yes' : 'No / unknown'}</p><p className="rounded-lg bg-white p-3">Children: {profile.friendlyChildren ? 'Yes' : 'No / unknown'}</p></div></section>
          <section className="mt-7 rounded-xl border p-4"><h2 className="font-semibold">Share this safety profile</h2><p className="mt-2 break-all text-sm text-slate-600">{publicUrl}</p></section>
        </div>
      </article>
    </main>
  );
}
