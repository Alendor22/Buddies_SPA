import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DogStatus } from '@prisma/client';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function reportLostAction(formData: FormData) {
  'use server';
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const dogId = String(formData.get('dogId') ?? '').trim();
  const lastSeenLocation = String(formData.get('lastSeenLocation') ?? '').trim() || null;
  const lostReward = String(formData.get('lostReward') ?? '').trim() || null;
  const lostNotes = String(formData.get('lostNotes') ?? '').trim() || null;

  const dog = await prisma.dog.findFirst({ where: { id: dogId, ownerId: user.id }, select: { id: true, slug: true } });
  if (!dog) redirect('/dashboard/lost/report?error=dog');

  await prisma.dog.update({
    where: { id: dog.id },
    data: { status: DogStatus.LOST, lostSince: new Date(), lastSeenLocation, lostReward, lostNotes }
  });

  redirect(`/dogs/${dog.slug}?lost=1`);
}

async function markSafeAction(formData: FormData) {
  'use server';
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');
  const dogId = String(formData.get('dogId') ?? '').trim();
  const dog = await prisma.dog.findFirst({ where: { id: dogId, ownerId: user.id }, select: { id: true, slug: true } });
  if (!dog) redirect('/dashboard/lost/report?error=dog');
  await prisma.dog.update({ where: { id: dog.id }, data: { status: DogStatus.SAFE, lostSince: null, lastSeenLocation: null, lostReward: null, lostNotes: null } });
  redirect(`/dogs/${dog.slug}?safe=1`);
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
      <p className="mt-2 text-slate-600">Mark a dog as LOST, publish the safety status on its QR profile, and surface the alert in Notifications.</p>

      {error ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Select one of your own dog profiles.</div> : null}

      {dogs.length === 0 ? (
        <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">No dog profiles</h2>
          <p className="mt-2 text-slate-600">Create a profile before using lost dog mode.</p>
          <Link href="/dogs/new" className="mt-5 inline-block rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Add Profile</Link>
        </section>
      ) : (
        <section className="mt-8 grid gap-5">
          <form action={reportLostAction} className="grid gap-4 rounded-2xl border bg-white p-6 shadow-sm">
            <label className="grid gap-2 text-sm font-medium">Dog profile<select name="dogId" required className="rounded-lg border px-3 py-3 text-base">{dogs.map((dog) => <option key={dog.id} value={dog.id}>{dog.name}{dog.breed ? ` · ${dog.breed}` : ''} · {dog.status}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-medium">Last seen location<input name="lastSeenLocation" placeholder="Street, park, cross streets, or neighborhood" className="rounded-lg border px-3 py-3 text-base" /></label>
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
