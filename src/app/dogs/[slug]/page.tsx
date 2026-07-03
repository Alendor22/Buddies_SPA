import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function DogProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dog = slug === 'demo' ? null : await prisma.dog.findUnique({ where: { slug }, include: { owner: true } });

  if (!dog && slug !== 'demo') notFound();

  const profile = dog ?? {
    publicId: 'demo-buddy',
    name: 'Buddy',
    breed: 'Mixed breed',
    status: 'SAFE',
    photoUrl: null,
    birthDate: null,
    weightLbs: null,
    gender: null,
    temperament: 'Friendly and calm around people.',
    medicalNotes: 'No known allergies',
    vaccinationNotes: 'Vaccinations current',
    emergencyContact: '(555) 010-2026',
    spayedNeutered: true,
    friendlyDogs: true,
    friendlyCats: false,
    friendlyChildren: true,
    owner: { displayName: 'Demo Owner' }
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-5 flex items-center justify-between gap-4">
        <Link href="/dogs" className="text-sm font-medium underline">All dogs</Link>
        <Link href="/dashboard" className="rounded-lg border px-4 py-2">Dashboard</Link>
      </div>

      <article className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        {profile.photoUrl ? <img src={profile.photoUrl} alt={`${profile.name} profile`} className="h-72 w-full object-cover" /> : null}
        <div className="p-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Public dog ID · {profile.publicId}</p>
          <h1 className="mt-2 text-4xl font-bold">{profile.name}</h1>
          <p className="mt-2 text-slate-600">{profile.breed ?? 'Breed not listed'} · Owner: {profile.owner.displayName}</p>

          <div className={`mt-6 rounded-xl p-4 font-medium ${profile.status === 'SAFE' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>
            Status: {profile.status}
          </div>

          <dl className="mt-6 grid gap-5 sm:grid-cols-2">
            <div><dt className="font-semibold">Age / birth date</dt><dd className="text-slate-600">{profile.birthDate ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(profile.birthDate) : 'Not provided'}</dd></div>
            <div><dt className="font-semibold">Weight</dt><dd className="text-slate-600">{profile.weightLbs ? `${profile.weightLbs} lb` : 'Not provided'}</dd></div>
            <div><dt className="font-semibold">Gender</dt><dd className="text-slate-600">{profile.gender ?? 'Not provided'}</dd></div>
            <div><dt className="font-semibold">Spayed / neutered</dt><dd className="text-slate-600">{profile.spayedNeutered ? 'Yes' : 'No / not specified'}</dd></div>
            <div className="sm:col-span-2"><dt className="font-semibold">Temperament</dt><dd className="text-slate-600">{profile.temperament ?? 'Not provided'}</dd></div>
            <div className="sm:col-span-2"><dt className="font-semibold">Vaccination notes</dt><dd className="text-slate-600">{profile.vaccinationNotes ?? 'Not provided'}</dd></div>
            <div className="sm:col-span-2"><dt className="font-semibold">Medical notes</dt><dd className="text-slate-600">{profile.medicalNotes ?? 'None provided'}</dd></div>
            <div className="sm:col-span-2"><dt className="font-semibold">Emergency contact</dt><dd className="text-slate-600">{profile.emergencyContact ?? 'Not provided'}</dd></div>
          </dl>

          <section className="mt-7 rounded-xl bg-slate-50 p-4">
            <h2 className="font-semibold">Compatibility</h2>
            <p className="mt-2 text-slate-600">
              Dogs: {profile.friendlyDogs ? 'Yes' : 'No'} · Cats: {profile.friendlyCats ? 'Yes' : 'No'} · Children: {profile.friendlyChildren ? 'Yes' : 'No'}
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
