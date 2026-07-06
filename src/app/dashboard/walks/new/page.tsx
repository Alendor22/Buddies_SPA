import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function createWalkAction(formData: FormData) {
  'use server';

  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const dogId = String(formData.get('dogId') ?? '').trim();
  const startsAtRaw = String(formData.get('startsAt') ?? '').trim();
  const durationMin = Number(formData.get('durationMin') ?? 30);
  const notes = String(formData.get('notes') ?? '').trim() || null;

  if (!dogId || !startsAtRaw || !Number.isFinite(durationMin)) redirect('/dashboard/walks/new?error=invalid');

  const dog = await prisma.dog.findFirst({ where: { id: dogId, ownerId: user.id }, select: { id: true } });
  if (!dog) redirect('/dashboard/walks/new?error=dog');

  await prisma.walk.create({
    data: {
      dogId,
      requesterId: user.id,
      startsAt: new Date(startsAtRaw),
      durationMin: Math.max(10, Math.min(240, Math.round(durationMin))),
      notes
    }
  });

  redirect('/dashboard/buddies?walk=created');
}

export default async function NewWalkPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');
  const { error } = await searchParams;

  const dogs = await prisma.dog.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, breed: true }
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="text-sm font-medium text-slate-500">Buddies V2.4 Walk Composer</p>
      <h1 className="mt-2 text-3xl font-bold">Create walk</h1>
      <p className="mt-2 text-slate-600">Start a walk request for one of your dog profiles. Buddy invitations can be attached from the Buddies screen.</p>

      {error ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Unable to create the walk. Select one of your dogs and enter a valid start time.</div> : null}

      {dogs.length === 0 ? (
        <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">No profiles yet</h2>
          <p className="mt-2 text-slate-600">Create a dog profile before creating a walk.</p>
          <Link href="/dogs/new" className="mt-5 inline-block rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Add Profile</Link>
        </section>
      ) : (
        <form action={createWalkAction} className="mt-8 grid gap-4 rounded-2xl border bg-white p-6 shadow-sm">
          <label className="grid gap-2 text-sm font-medium">
            Dog profile
            <select name="dogId" required className="rounded-lg border px-3 py-3 text-base">
              {dogs.map((dog) => <option key={dog.id} value={dog.id}>{dog.name}{dog.breed ? ` · ${dog.breed}` : ''}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Start time
            <input name="startsAt" type="datetime-local" required className="rounded-lg border px-3 py-3 text-base" />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Duration
            <select name="durationMin" defaultValue="30" className="rounded-lg border px-3 py-3 text-base">
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">60 minutes</option>
              <option value="90">90 minutes</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Notes
            <textarea name="notes" rows={4} placeholder="Optional route, pickup, or temperament notes" className="rounded-lg border px-3 py-3 text-base" />
          </label>
          <button className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Create walk</button>
          <Link href="/dashboard/buddies" className="rounded-lg border px-5 py-3 text-center font-medium">Back to Buddies</Link>
        </form>
      )}
    </main>
  );
}
