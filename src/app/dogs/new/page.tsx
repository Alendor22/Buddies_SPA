import { DogStatus } from '@prisma/client';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { findDuplicateDog, normalizeDogName, uniqueDogSlug } from '@/lib/dogWrites';
import { cleanPlainText, optionalPlainText } from '@/lib/mutations';

export const dynamic = 'force-dynamic';

type SearchParams = { error?: string };

function checkbox(value: FormDataEntryValue | null) {
  return value === 'on' || value === 'true';
}

function parseOptionalDate(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseOptionalInteger(value: string, min: number, max: number) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : Number.NaN;
}

function parseStatus(value: string) {
  return Object.values(DogStatus).includes(value as DogStatus) ? value as DogStatus : DogStatus.SAFE;
}

function optionalUrl(value: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

async function createDogAction(formData: FormData) {
  'use server';

  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const name = normalizeDogName(formData.get('name'));
  const birthDateRaw = cleanPlainText(formData.get('birthDate'), 32);
  const weightRaw = cleanPlainText(formData.get('weightLbs'), 16);
  const photoUrlRaw = cleanPlainText(formData.get('photoUrl'), 2048);
  const birthDate = parseOptionalDate(birthDateRaw);
  const weightLbs = parseOptionalInteger(weightRaw, 1, 300);
  const photoUrl = optionalUrl(photoUrlRaw);

  if (!name) redirect('/dogs/new?error=name');
  if (birthDateRaw && !birthDate) redirect('/dogs/new?error=date');
  if (Number.isNaN(weightLbs)) redirect('/dogs/new?error=weight');
  if (photoUrlRaw && !photoUrl) redirect('/dogs/new?error=url');

  const duplicate = await findDuplicateDog(user.id, name);
  if (duplicate) redirect('/dogs/new?error=duplicate');

  try {
    const dog = await prisma.dog.create({
      data: {
        ownerId: user.id,
        name,
        slug: await uniqueDogSlug(name),
        breed: optionalPlainText(formData.get('breed'), 120),
        birthDate,
        weightLbs,
        gender: optionalPlainText(formData.get('gender'), 40),
        photoUrl,
        status: parseStatus(cleanPlainText(formData.get('status'), 16) || 'SAFE'),
        temperament: optionalPlainText(formData.get('temperament'), 500),
        medicalNotes: optionalPlainText(formData.get('medicalNotes'), 800),
        vaccinationNotes: optionalPlainText(formData.get('vaccinationNotes'), 800),
        emergencyContact: optionalPlainText(formData.get('emergencyContact'), 160),
        spayedNeutered: checkbox(formData.get('spayedNeutered')),
        friendlyDogs: checkbox(formData.get('friendlyDogs')),
        friendlyCats: checkbox(formData.get('friendlyCats')),
        friendlyChildren: checkbox(formData.get('friendlyChildren'))
      },
      select: { slug: true }
    });

    redirect(`/dogs/${encodeURIComponent(dog.slug)}?created=1`);
  } catch (error) {
    console.error('create dog action failed', error);
    redirect('/dogs/new?error=create');
  }
}

function errorMessage(error?: string) {
  if (error === 'name') return 'Enter a dog name of 80 characters or fewer.';
  if (error === 'date') return 'Enter a valid birth date.';
  if (error === 'weight') return 'Weight must be a whole number from 1 to 300 lb.';
  if (error === 'url') return 'Photo URL must be a valid http or https address.';
  if (error === 'duplicate') return 'You already have a dog profile with that name. Edit the existing profile instead of creating another.';
  return error ? 'The profile could not be created. Check the form and retry.' : null;
}

export default async function NewDogPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const { error } = await searchParams;
  const message = errorMessage(error);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Buddies dog profile</p>
          <h1 className="mt-1 text-3xl font-bold">Add dog</h1>
          <p className="mt-2 text-slate-600">Create an account-bound public safety profile with health, compatibility, and emergency details.</p>
        </div>
        <Link href="/dashboard" className="rounded-lg border px-4 py-2">Cancel</Link>
      </div>

      {message ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{message}</div> : null}

      <form action={createDogAction} className="mt-8 grid gap-6 rounded-2xl border bg-white p-6 shadow-sm">
        <section>
          <h2 className="text-xl font-semibold">Core profile</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">Name<input name="name" maxLength={80} required className="rounded-lg border px-3 py-3 text-base" /></label>
            <label className="grid gap-2 text-sm font-medium">Breed<input name="breed" maxLength={120} className="rounded-lg border px-3 py-3 text-base" /></label>
            <label className="grid gap-2 text-sm font-medium">Birth date<input name="birthDate" type="date" className="rounded-lg border px-3 py-3 text-base" /></label>
            <label className="grid gap-2 text-sm font-medium">Weight lb<input name="weightLbs" type="number" min="1" max="300" step="1" className="rounded-lg border px-3 py-3 text-base" /></label>
            <label className="grid gap-2 text-sm font-medium">Gender<select name="gender" className="rounded-lg border px-3 py-3 text-base"><option value="">Not specified</option><option value="Female">Female</option><option value="Male">Male</option></select></label>
            <label className="grid gap-2 text-sm font-medium">Safety status<select name="status" defaultValue="SAFE" className="rounded-lg border px-3 py-3 text-base"><option value="SAFE">Safe</option><option value="LOST">Lost</option><option value="FOUND">Found</option></select></label>
          </div>
        </section>

        <label className="grid gap-2 text-sm font-medium">Photo URL<input name="photoUrl" type="url" placeholder="https://..." className="rounded-lg border px-3 py-3 text-base" /></label>
        <label className="grid gap-2 text-sm font-medium">Temperament<textarea name="temperament" rows={3} maxLength={500} className="rounded-lg border px-3 py-3 text-base" /></label>
        <label className="grid gap-2 text-sm font-medium">Vaccination notes<textarea name="vaccinationNotes" rows={3} maxLength={800} className="rounded-lg border px-3 py-3 text-base" /></label>
        <label className="grid gap-2 text-sm font-medium">Medical notes<textarea name="medicalNotes" rows={3} maxLength={800} className="rounded-lg border px-3 py-3 text-base" /></label>
        <label className="grid gap-2 text-sm font-medium">Emergency contact<input name="emergencyContact" maxLength={160} className="rounded-lg border px-3 py-3 text-base" /></label>

        <fieldset className="grid gap-3 rounded-xl border p-4">
          <legend className="px-2 text-sm font-semibold">Compatibility</legend>
          <label className="flex items-center gap-3"><input name="spayedNeutered" type="checkbox" /> Spayed or neutered</label>
          <label className="flex items-center gap-3"><input name="friendlyDogs" type="checkbox" defaultChecked /> Friendly with dogs</label>
          <label className="flex items-center gap-3"><input name="friendlyCats" type="checkbox" /> Friendly with cats</label>
          <label className="flex items-center gap-3"><input name="friendlyChildren" type="checkbox" defaultChecked /> Friendly with children</label>
        </fieldset>

        <button type="submit" className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Create dog profile</button>
      </form>
    </main>
  );
}
