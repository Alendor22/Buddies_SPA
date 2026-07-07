import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function reportSightingAction(formData: FormData) {
  'use server';

  const slug = String(formData.get('slug') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim() || null;
  const latitudeRaw = String(formData.get('latitude') ?? '').trim();
  const longitudeRaw = String(formData.get('longitude') ?? '').trim();

  const dog = await prisma.dog.findUnique({ where: { slug }, select: { id: true, slug: true } });
  if (!dog) redirect('/dogs');

  const latitude = Number(latitudeRaw);
  const longitude = Number(longitudeRaw);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) redirect(`/dogs/${slug}/sighting?error=location`);

  await prisma.sighting.create({ data: { dogId: dog.id, note, latitude, longitude } });
  redirect(`/dogs/${dog.slug}?sighting=1`);
}

export default async function SightingPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ error?: string }> }) {
  const { slug } = await params;
  const { error } = await searchParams;
  const dog = await prisma.dog.findUnique({ where: { slug }, select: { name: true, slug: true, status: true, photoUrl: true, breed: true } });
  if (!dog) notFound();

  return (
    <main className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <p className="text-sm font-medium text-slate-500">Buddies Phase 1 Sighting Report</p>
      <h1 className="mt-2 text-3xl font-bold">Report sighting</h1>
      <p className="mt-2 text-slate-600">Submit a last-seen location for {dog.name}. This creates a recovery signal for the owner.</p>

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex gap-4">
          {dog.photoUrl ? <img src={dog.photoUrl} alt={`${dog.name} profile`} className="h-20 w-20 rounded-2xl object-cover" /> : <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 text-3xl">🐶</div>}
          <div><h2 className="text-xl font-semibold">{dog.name}</h2><p className="text-sm text-slate-600">{dog.breed ?? 'Breed not listed'} · {dog.status}</p></div>
        </div>
      </section>

      {error ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Latitude and longitude are required. Use current location or enter coordinates.</div> : null}

      <form action={reportSightingAction} className="mt-6 grid gap-4 rounded-2xl border bg-white p-6 shadow-sm">
        <input type="hidden" name="slug" value={dog.slug} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">Latitude<input name="latitude" inputMode="decimal" placeholder="40.000000" required className="rounded-lg border px-3 py-3 text-base" /></label>
          <label className="grid gap-2 text-sm font-medium">Longitude<input name="longitude" inputMode="decimal" placeholder="-74.000000" required className="rounded-lg border px-3 py-3 text-base" /></label>
        </div>
        <label className="grid gap-2 text-sm font-medium">Notes<textarea name="note" rows={4} placeholder="Direction seen, condition, collar, nearby landmark" className="rounded-lg border px-3 py-3 text-base" /></label>
        <button className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Submit sighting</button>
        <Link href={`/dogs/${dog.slug}`} className="rounded-lg border px-5 py-3 text-center font-medium">Back to profile</Link>
      </form>
    </main>
  );
}
