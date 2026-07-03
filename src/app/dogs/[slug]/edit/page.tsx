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

  const publicUrl = `/dogs/${dog.slug}`;
  const qrPageUrl = `/dogs/${dog.slug}/qr`;
  const birthDate = dog.birthDate ? dog.birthDate.toISOString().slice(0, 10) : '';

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Buddies V2.1</p>
          <h1 className="text-3xl font-bold">Edit {dog.name}</h1>
          <p className="mt-2 text-slate-600">Update safety data, public profile fields, QR identity, and compatibility details.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={publicUrl} className="rounded-lg border px-4 py-2">Public page</Link>
          <Link href={qrPageUrl} className="rounded-lg border px-4 py-2">QR page</Link>
          <Link href="/dashboard" className="rounded-lg border px-4 py-2">Dashboard</Link>
        </div>
      </div>

      <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Public identity</h2>
        <p className="mt-2 break-all text-slate-600">https://buddies.vercel.app{publicUrl}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={publicUrl} className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white">Open public page</Link>
          <Link href={qrPageUrl} className="rounded-lg border px-4 py-2">Show QR Code</Link>
        </div>
      </section>

      <form action="/api/dogs/manage" method="post" className="mt-6 grid gap-6 rounded-2xl border bg-white p-6 shadow-sm">
        <input type="hidden" name="id" value={dog.id} />
        <input type="hidden" name="_intent" value="update" />

        <section>
          <h2 className="text-xl font-semibold">Core profile</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">Name<input name="name" defaultValue={dog.name} required maxLength={80} className="rounded-lg border px-3 py-3 text-base" /></label>
            <label className="grid gap-2 text-sm font-medium">Breed<input name="breed" defaultValue={dog.breed ?? ''} maxLength={120} className="rounded-lg border px-3 py-3 text-base" /></label>
            <label className="grid gap-2 text-sm font-medium">Birth date<input name="birthDate" type="date" defaultValue={birthDate} className="rounded-lg border px-3 py-3 text-base" /></label>
            <label className="grid gap-2 text-sm font-medium">Weight <span className="font-normal text-slate-500">lb</span><input name="weightLbs" type="number" min="1" max="300" defaultValue={dog.weightLbs ?? ''} className="rounded-lg border px-3 py-3 text-base" /></label>
            <label className="grid gap-2 text-sm font-medium">Gender<input name="gender" defaultValue={dog.gender ?? ''} maxLength={40} className="rounded-lg border px-3 py-3 text-base" /></label>
            <label className="grid gap-2 text-sm font-medium">Photo URL<input name="photoUrl" type="url" placeholder="https://..." defaultValue={dog.photoUrl ?? ''} className="rounded-lg border px-3 py-3 text-base" /></label>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Safety and health</h2>
          <div className="mt-4 grid gap-4">
            <label className="grid gap-2 text-sm font-medium">Temperament<textarea name="temperament" defaultValue={dog.temperament ?? ''} rows={3} maxLength={500} className="rounded-lg border px-3 py-3 text-base" /></label>
            <label className="grid gap-2 text-sm font-medium">Medical notes<textarea name="medicalNotes" defaultValue={dog.medicalNotes ?? ''} rows={3} maxLength={800} className="rounded-lg border px-3 py-3 text-base" /></label>
            <label className="grid gap-2 text-sm font-medium">Vaccination notes<textarea name="vaccinationNotes" defaultValue={dog.vaccinationNotes ?? ''} rows={3} maxLength={800} className="rounded-lg border px-3 py-3 text-base" /></label>
            <label className="grid gap-2 text-sm font-medium">Emergency contact<input name="emergencyContact" defaultValue={dog.emergencyContact ?? ''} maxLength={160} className="rounded-lg border px-3 py-3 text-base" /></label>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Location</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">Latitude<input name="latitude" type="number" step="any" defaultValue={dog.latitude ?? ''} className="rounded-lg border px-3 py-3 text-base" /></label>
            <label className="grid gap-2 text-sm font-medium">Longitude<input name="longitude" type="number" step="any" defaultValue={dog.longitude ?? ''} className="rounded-lg border px-3 py-3 text-base" /></label>
          </div>
        </section>

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
