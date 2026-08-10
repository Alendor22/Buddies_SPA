import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const FIELD_ERRORS: Record<string, string> = {
  name: 'Enter a dog name.',
  duplicateName: 'You already have a dog profile with this name. Use a different name or edit the existing profile.',
  birthDate: 'Enter a valid birth date.',
  weightLbs: 'Weight must be a whole number between 1 and 300 lb.',
  photoUrl: 'Enter a valid http or https photo URL.',
  latitude: 'Latitude must be between -90 and 90.',
  longitude: 'Longitude must be between -180 and 180.'
};

function FieldError({ field, error }: { field: string; error?: string }) {
  if (error !== field) return null;
  return <p className="text-sm font-medium text-red-700" role="alert">{FIELD_ERRORS[field]}</p>;
}

export default async function MobileDogEditPage({ searchParams }: { searchParams: Promise<{ slug?: string; saved?: string; error?: string; code?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const { slug, saved, error, code } = await searchParams;
  if (!slug) notFound();

  const dog = await prisma.dog.findFirst({ where: { slug, ownerId: user.id } });
  if (!dog) notFound();

  const birthDate = dog.birthDate ? dog.birthDate.toISOString().slice(0, 10) : '';
  const formError = error === 'form'
    ? code === 'CONFLICT'
      ? 'That value conflicts with an existing record. Review the form and try again.'
      : 'We could not save your changes. Please try again.'
    : null;
  const nameError = error === 'name' || error === 'duplicateName';

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Buddies dog profile</p>
          <h1 className="text-3xl font-bold">Edit {dog.name}</h1>
          <p className="mt-2 text-slate-600">Update profile, safety, health, location, and compatibility attributes.</p>
        </div>
        <Link href={`/dogs/${dog.slug}`} className="rounded-lg border px-4 py-2">Cancel</Link>
      </div>

      {saved ? <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800">Changes saved.</div> : null}
      {formError ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700" role="alert">{formError}</div> : null}

      <form action="/api/dogs/manage" method="post" className="mt-6 grid gap-6 rounded-2xl border bg-white p-6 shadow-sm">
        <input type="hidden" name="id" value={dog.id} />
        <input type="hidden" name="_intent" value="update" />
        <label className="grid gap-2 text-sm font-medium">Name<input name="name" defaultValue={dog.name} required maxLength={80} aria-invalid={nameError} className="rounded-lg border px-3 py-3 text-base" />{error === 'duplicateName' ? <FieldError field="duplicateName" error={error} /> : <FieldError field="name" error={error} />}</label>
        <label className="grid gap-2 text-sm font-medium">Breed<input name="breed" defaultValue={dog.breed ?? ''} maxLength={120} className="rounded-lg border px-3 py-3 text-base" /></label>
        <label className="grid gap-2 text-sm font-medium">Birth date<input name="birthDate" type="date" defaultValue={birthDate} aria-invalid={error === 'birthDate'} className="rounded-lg border px-3 py-3 text-base" /><FieldError field="birthDate" error={error} /></label>
        <label className="grid gap-2 text-sm font-medium">Weight lb<input name="weightLbs" type="number" min="1" max="300" step="1" defaultValue={dog.weightLbs ?? ''} aria-invalid={error === 'weightLbs'} className="rounded-lg border px-3 py-3 text-base" /><FieldError field="weightLbs" error={error} /></label>
        <label className="grid gap-2 text-sm font-medium">Gender<select name="gender" defaultValue={dog.gender ?? ''} className="rounded-lg border px-3 py-3 text-base"><option value="">Not specified</option><option value="Female">Female</option><option value="Male">Male</option></select></label>
        <label className="grid gap-2 text-sm font-medium">Safety status<select name="status" defaultValue={dog.status} className="rounded-lg border px-3 py-3 text-base"><option value="SAFE">Safe</option><option value="LOST">Lost</option><option value="FOUND">Found</option></select></label>
        <label className="grid gap-2 text-sm font-medium">Photo URL<input name="photoUrl" type="url" defaultValue={dog.photoUrl ?? ''} aria-invalid={error === 'photoUrl'} className="rounded-lg border px-3 py-3 text-base" /><FieldError field="photoUrl" error={error} /></label>
        <label className="grid gap-2 text-sm font-medium">Temperament<textarea name="temperament" defaultValue={dog.temperament ?? ''} rows={3} maxLength={500} className="rounded-lg border px-3 py-3 text-base" /></label>
        <label className="grid gap-2 text-sm font-medium">Medical notes<textarea name="medicalNotes" defaultValue={dog.medicalNotes ?? ''} rows={3} maxLength={800} className="rounded-lg border px-3 py-3 text-base" /></label>
        <label className="grid gap-2 text-sm font-medium">Vaccination notes<textarea name="vaccinationNotes" defaultValue={dog.vaccinationNotes ?? ''} rows={3} maxLength={800} className="rounded-lg border px-3 py-3 text-base" /></label>
        <label className="grid gap-2 text-sm font-medium">Emergency contact<input name="emergencyContact" defaultValue={dog.emergencyContact ?? ''} maxLength={160} className="rounded-lg border px-3 py-3 text-base" /></label>
        <label className="grid gap-2 text-sm font-medium">Latitude<input name="latitude" type="number" min="-90" max="90" step="any" defaultValue={dog.latitude ?? ''} aria-invalid={error === 'latitude'} className="rounded-lg border px-3 py-3 text-base" /><FieldError field="latitude" error={error} /></label>
        <label className="grid gap-2 text-sm font-medium">Longitude<input name="longitude" type="number" min="-180" max="180" step="any" defaultValue={dog.longitude ?? ''} aria-invalid={error === 'longitude'} className="rounded-lg border px-3 py-3 text-base" /><FieldError field="longitude" error={error} /></label>
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
