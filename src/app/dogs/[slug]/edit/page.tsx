import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function EditDogPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const { slug } = await params;
  const dog = await prisma.dog.findFirst({
    where: { slug, ownerId: user.id },
    select: {
      id: true,
      publicId: true,
      slug: true,
      name: true,
      breed: true,
      birthDate: true,
      weightLbs: true,
      gender: true,
      photoUrl: true,
      status: true,
      temperament: true,
      medicalNotes: true,
      vaccinationNotes: true,
      emergencyContact: true,
      latitude: true,
      longitude: true,
      spayedNeutered: true,
      friendlyDogs: true,
      friendlyCats: true,
      friendlyChildren: true
    }
  });
  if (!dog) notFound();

  const publicId = dog.publicId ?? dog.id;
  const publicUrl = `/dogs/${dog.slug}`;
  const birthDate = dog.birthDate ? dog.birthDate.toISOString().slice(0, 10) : '';

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Buddies V2</p>
          <h1 className="text-3xl font-bold">Edit {dog.name}</h1>
          <p className="mt-2 text-slate-600">Manage profile data and public identity.</p>
        </div>
        <div className="flex gap-2">
          <Link href={publicUrl} className="rounded-lg border px-4 py-2">Public page</Link>
          <Link href="/dashboard" className="rounded-lg border px-4 py-2">Dashboard</Link>
        </div>
      </div>

      <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Public identity</h2>
        <p className="mt-2 break-all text-slate-600">{publicUrl}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={publicUrl} className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white">Open public page</Link>
          <Link href={`/api/qr/${publicId}`} className="rounded-lg border px-4 py-2">Open QR SVG</Link>
        </div>
      </section>

      <form action="/api/dogs/manage" method="post" className="mt-6 grid gap-6 rounded-2xl border bg-white p-6 shadow-sm">
        <input type="hidden" name="id" value={dog.id} />
        <input type="hidden" name="_intent" value="update" />
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">Name<input name="name" defaultValue={dog.name} required className="rounded-lg border px-3 py-3 text-base" /></label>
          <label className="grid gap-2 text-sm font-medium">Breed<input name="breed" defaultValue={dog.breed ?? ''} className="rounded-lg border px-3 py-3 text-base" /></label>
          <label className="grid gap-2 text-sm font-medium">Birth date<input name="birthDate" type="date" defaultValue={birthDate} className="rounded-lg border px-3 py-3 text-base" /></label>
          <label className="grid gap-2 text-sm font-medium">Weight<input name="weightLbs" type="number" defaultValue={dog.weightLbs ?? ''} className="rounded-lg border px-3 py-3 text-base" /></label>
          <label className="grid gap-2 text-sm font-medium">Gender<input name="gender" defaultValue={dog.gender ?? ''} className="rounded-lg border px-3 py-3 text-base" /></label>
          <label className="grid gap-2 text-sm font-medium">Photo URL<input name="photoUrl" defaultValue={dog.photoUrl ?? ''} className="rounded-lg border px-3 py-3 text-base" /></label>
          <label className="grid gap-2 text-sm font-medium">Latitude<input name="latitude" type="number" step="any" defaultValue={dog.latitude ?? ''} className="rounded-lg border px-3 py-3 text-base" /></label>
          <label className="grid gap-2 text-sm font-medium">Longitude<input name="longitude" type="number" step="any" defaultValue={dog.longitude ?? ''} className="rounded-lg border px-3 py-3 text-base" /></label>
        </div>
        <label className="grid gap-2 text-sm font-medium">Temperament<textarea name="temperament" defaultValue={dog.temperament ?? ''} rows={3} className="rounded-lg border px-3 py-3 text-base" /></label>
        <label className="grid gap-2 text-sm font-medium">Medical notes<textarea name="medicalNotes" defaultValue={dog.medicalNotes ?? ''} rows={3} className="rounded-lg border px-3 py-3 text-base" /></label>
        <label className="grid gap-2 text-sm font-medium">Vaccination notes<textarea name="vaccinationNotes" defaultValue={dog.vaccinationNotes ?? ''} rows={3} className="rounded-lg border px-3 py-3 text-base" /></label>
        <label className="grid gap-2 text-sm font-medium">Emergency contact<input name="emergencyContact" defaultValue={dog.emergencyContact ?? ''} className="rounded-lg border px-3 py-3 text-base" /></label>
        <fieldset className="grid gap-3 rounded-xl border p-4">
          <legend className="px-2 text-sm font-semibold">Compatibility</legend>
          <label className="flex items-center gap-3"><input name="spayedNeutered" type="checkbox" defaultChecked={dog.spayedNeutered} /> Spayed or neutered</label>
          <label className="flex items-center gap-3"><input name="friendlyDogs" type="checkbox" defaultChecked={dog.friendlyDogs} /> Friendly with dogs</label>
          <label className="flex items-center gap-3"><input name="friendlyCats" type="checkbox" defaultChecked={dog.friendlyCats} /> Friendly with cats</label>
          <label className="flex items-center gap-3"><input name="friendlyChildren" type="checkbox" defaultChecked={dog.friendlyChildren} /> Friendly with children</label>
        </fieldset>
        <button className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Save changes</button>
      </form>
    </main>
  );
}
