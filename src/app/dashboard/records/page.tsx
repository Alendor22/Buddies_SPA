import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function createRecordAction(formData: FormData) {
  'use server';
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const dogId = String(formData.get('dogId') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const recordType = String(formData.get('recordType') ?? '').trim() || null;
  const dueAtRaw = String(formData.get('dueAt') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim() || null;
  const documentUrl = String(formData.get('documentUrl') ?? '').trim() || null;

  if (!dogId || !title) redirect('/dashboard/records?error=invalid');
  const dog = await prisma.dog.findFirst({ where: { id: dogId, ownerId: user.id }, select: { id: true } });
  if (!dog) redirect('/dashboard/records?error=dog');

  await prisma.vetRecord.create({
    data: { dogId, ownerId: user.id, title, recordType, notes, documentUrl, dueAt: dueAtRaw ? new Date(`${dueAtRaw}T12:00:00.000Z`) : null }
  });
  redirect('/dashboard/records?created=1');
}

export default async function RecordsPage({ searchParams }: { searchParams: Promise<{ error?: string; created?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');
  const params = await searchParams;

  const [dogs, records] = await Promise.all([
    prisma.dog.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, breed: true, slug: true } }),
    prisma.vetRecord.findMany({ where: { ownerId: user.id }, orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }], take: 50, include: { dog: { select: { name: true, slug: true } } } })
  ]).catch(() => [[], []] as const);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-sm font-medium text-slate-500">Buddies Phase 1 Records</p><h1 className="text-3xl font-bold">Vet records</h1><p className="mt-2 text-slate-600">Track vaccinations, medical reminders, document links, and due dates for your dog profiles.</p></div>
        <Link href="/dashboard" className="rounded-lg border px-4 py-2">Dashboard</Link>
      </div>

      {params.created ? <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">Record saved.</div> : null}
      {params.error ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Select one of your dogs and enter a record title.</div> : null}

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <form action={createRecordAction} className="grid gap-4 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Add record</h2>
          <label className="grid gap-2 text-sm font-medium">Dog<select name="dogId" required className="rounded-lg border px-3 py-3 text-base">{dogs.map((dog) => <option key={dog.id} value={dog.id}>{dog.name}{dog.breed ? ` · ${dog.breed}` : ''}</option>)}</select></label>
          <label className="grid gap-2 text-sm font-medium">Title<input name="title" placeholder="Rabies vaccine, annual exam, medication" required className="rounded-lg border px-3 py-3 text-base" /></label>
          <label className="grid gap-2 text-sm font-medium">Type<input name="recordType" placeholder="vaccine, exam, medication, document" className="rounded-lg border px-3 py-3 text-base" /></label>
          <label className="grid gap-2 text-sm font-medium">Due date<input name="dueAt" type="date" className="rounded-lg border px-3 py-3 text-base" /></label>
          <label className="grid gap-2 text-sm font-medium">Document URL<input name="documentUrl" type="url" placeholder="https://..." className="rounded-lg border px-3 py-3 text-base" /></label>
          <label className="grid gap-2 text-sm font-medium">Notes<textarea name="notes" rows={4} className="rounded-lg border px-3 py-3 text-base" /></label>
          <button className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Save record</button>
        </form>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Existing records</h2>
          <div className="mt-4 grid gap-3">
            {records.length === 0 ? <p className="text-sm text-slate-600">No records saved yet.</p> : records.map((record) => <article key={record.id} className="rounded-xl border p-4"><h3 className="font-semibold">{record.title}</h3><p className="text-sm text-slate-600">{record.dog.name} · {record.recordType ?? 'record'}{record.dueAt ? ` · due ${record.dueAt.toLocaleDateString()}` : ''}</p>{record.notes ? <p className="mt-2 text-sm text-slate-700">{record.notes}</p> : null}{record.documentUrl ? <a href={record.documentUrl} className="mt-3 inline-block rounded-lg border px-4 py-2 text-sm font-medium">Open document</a> : null}<Link href={`/dogs/${record.dog.slug}`} className="ml-2 mt-3 inline-block rounded-lg border px-4 py-2 text-sm font-medium">Dog profile</Link></article>)}
          </div>
        </section>
      </section>
    </main>
  );
}
