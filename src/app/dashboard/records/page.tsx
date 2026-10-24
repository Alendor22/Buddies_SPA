import Link from 'next/link';
import { redirect } from 'next/navigation';
import { NotificationType } from '@/generated/prisma/client';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { UI_ROUTES } from '@/lib/uiRoutes';

export const dynamic = 'force-dynamic';

function parseDueDate(value: string) {
  if (!value) return null;
  const dueAt = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(dueAt.getTime()) ? null : dueAt;
}

async function createRecordAction(formData: FormData) {
  'use server';
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const dogId = String(formData.get('dogId') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const recordType = String(formData.get('recordType') ?? '').trim() || null;
  const dueAt = parseDueDate(String(formData.get('dueAt') ?? '').trim());
  const notes = String(formData.get('notes') ?? '').trim() || null;
  const documentUrl = String(formData.get('documentUrl') ?? '').trim() || null;

  if (!dogId || !title) redirect(`${UI_ROUTES.records}?error=invalid`);

  const dog = await prisma.dog.findFirst({
    where: { id: dogId, ownerId: user.id },
    select: { id: true, name: true }
  });
  if (!dog) redirect(`${UI_ROUTES.records}?error=dog`);

  await prisma.$transaction(async (tx) => {
    const record = await tx.vetRecord.create({
      data: { dogId, ownerId: user.id, title, recordType, notes, documentUrl, dueAt }
    });

    if (dueAt) {
      await tx.notification.create({
        data: {
          userId: user.id,
          type: NotificationType.VET_REMINDER,
          routeKey: 'records',
          href: `${UI_ROUTES.records}#record-${record.id}`,
          title: `${dog.name}: ${title} due ${dueAt.toLocaleDateString()}`,
          body: notes ?? `${recordType ?? 'Vet record'} reminder`,
          dogId: dog.id
        }
      });
    }
  });

  redirect(`${UI_ROUTES.records}?created=1`);
}

async function deleteRecordAction(formData: FormData) {
  'use server';
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const recordId = String(formData.get('recordId') ?? '').trim();
  if (!recordId) redirect(`${UI_ROUTES.records}?error=invalid`);

  const result = await prisma.vetRecord.deleteMany({
    where: { id: recordId, ownerId: user.id }
  });

  redirect(`${UI_ROUTES.records}?${result.count ? 'deleted=1' : 'error=record'}`);
}

export default async function RecordsPage({ searchParams }: { searchParams: Promise<{ error?: string; created?: string; deleted?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');
  const params = await searchParams;

  const [dogs, records] = await Promise.all([
    prisma.dog.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, breed: true, slug: true }
    }),
    prisma.vetRecord.findMany({
      where: { ownerId: user.id },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      take: 50,
      include: { dog: { select: { name: true, slug: true } } }
    })
  ]).catch(() => [[], []] as const);

  const now = new Date();
  const overdue = records.filter((record) => record.dueAt && record.dueAt < now);
  const upcoming = records.filter((record) => record.dueAt && record.dueAt >= now);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Buddies Phase 1 Records</p>
          <h1 className="text-3xl font-bold">Vet records</h1>
          <p className="mt-2 text-slate-600">Track vaccinations, medical records, documents, due dates, and persistent reminder notifications.</p>
        </div>
        <Link href={UI_ROUTES.dashboard} className="rounded-lg border px-4 py-2">Dashboard</Link>
      </div>

      {params.created ? <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">Record saved. A notification was created when a due date was supplied.</div> : null}
      {params.deleted ? <div className="mt-6 rounded-xl border bg-white p-4 text-sm text-slate-700">Record removed.</div> : null}
      {params.error ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Select one of your dogs and enter valid record details.</div> : null}

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Records</p><p className="mt-2 text-3xl font-bold">{records.length}</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Upcoming</p><p className="mt-2 text-3xl font-bold">{upcoming.length}</p></article>
        <article className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm"><p className="text-sm text-red-700">Overdue</p><p className="mt-2 text-3xl font-bold text-red-800">{overdue.length}</p></article>
      </section>

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
            {records.length === 0 ? <p className="text-sm text-slate-600">No records saved yet.</p> : records.map((record) => {
              const isOverdue = Boolean(record.dueAt && record.dueAt < now);
              return (
                <article id={`record-${record.id}`} key={record.id} className={`scroll-mt-24 rounded-xl border p-4 ${isOverdue ? 'border-red-200 bg-red-50' : ''}`}>
                  <h3 className="font-semibold">{record.title}</h3>
                  <p className="text-sm text-slate-600">{record.dog.name} · {record.recordType ?? 'record'}{record.dueAt ? ` · due ${record.dueAt.toLocaleDateString()}` : ''}</p>
                  {isOverdue ? <p className="mt-1 text-sm font-semibold text-red-700">Overdue</p> : null}
                  {record.notes ? <p className="mt-2 text-sm text-slate-700">{record.notes}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {record.documentUrl ? <a href={record.documentUrl} target="_blank" rel="noreferrer" className="rounded-lg border px-4 py-2 text-sm font-medium">Open document</a> : null}
                    <Link href={`/dogs/${record.dog.slug}`} className="rounded-lg border px-4 py-2 text-sm font-medium">Dog profile</Link>
                    <form action={deleteRecordAction}><input type="hidden" name="recordId" value={record.id} /><button className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700">Delete</button></form>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}
