import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

function completeness(dog: {
  breed: string | null;
  photoUrl: string | null;
  birthDate: Date | null;
  weightLbs: number | null;
  temperament: string | null;
  medicalNotes: string | null;
  vaccinationNotes: string | null;
  emergencyContact: string | null;
}) {
  const fields = [dog.breed, dog.photoUrl, dog.birthDate, dog.weightLbs, dog.temperament, dog.medicalNotes, dog.vaccinationNotes, dog.emergencyContact];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const dogs = await prisma.dog.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      slug: true,
      breed: true,
      status: true,
      photoUrl: true,
      birthDate: true,
      weightLbs: true,
      temperament: true,
      medicalNotes: true,
      vaccinationNotes: true,
      emergencyContact: true
    }
  });

  const lostCount = dogs.filter((dog) => dog.status !== 'SAFE').length;
  const completeCount = dogs.filter((dog) => completeness(dog) >= 75).length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Buddies V2.1</p>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-2 text-slate-600">Signed in as {user.displayName}. Manage safety profiles, QR pages, and public dog records.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dogs/new" className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white">Add dog</Link>
          <Link href="/dogs" className="rounded-lg border px-4 py-2">Browse dogs</Link>
          <form action="/api/session/end" method="post">
            <button className="rounded-lg border px-4 py-2">Sign out</button>
          </form>
        </div>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Profiles</p>
          <p className="mt-2 text-3xl font-bold">{dogs.length}</p>
          <p className="mt-1 text-sm text-slate-600">Dogs owned by this account</p>
        </article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Safety alerts</p>
          <p className="mt-2 text-3xl font-bold">{lostCount}</p>
          <p className="mt-1 text-sm text-slate-600">Profiles not marked safe</p>
        </article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Ready profiles</p>
          <p className="mt-2 text-3xl font-bold">{completeCount}</p>
          <p className="mt-1 text-sm text-slate-600">At least 75% complete</p>
        </article>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">My dogs</h2>
            <p className="mt-1 text-slate-600">Open a public profile, manage details, or show the QR page.</p>
          </div>
          <Link href="/dogs/new" className="text-sm font-medium underline">Create another profile</Link>
        </div>

        {dogs.length === 0 ? (
          <div className="mt-5 rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold">No dogs added yet</h3>
            <p className="mt-2 text-slate-600">Create your first dog profile to generate a public safety record and QR page.</p>
            <Link href="/dogs/new" className="mt-5 inline-block rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Create dog profile</Link>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {dogs.map((dog) => {
              const percent = completeness(dog);
              return (
                <article key={dog.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                  {dog.photoUrl ? (
                    <img src={dog.photoUrl} alt={`${dog.name} profile`} className="h-44 w-full object-cover" />
                  ) : (
                    <div className="flex h-44 items-center justify-center bg-slate-100 text-sm font-medium text-slate-500">No photo yet</div>
                  )}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-semibold">{dog.name}</h3>
                        <p className="mt-1 text-slate-600">{dog.breed ?? 'Breed not listed'}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${dog.status === 'SAFE' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>{dog.status}</span>
                    </div>
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Profile completeness</span>
                        <span>{percent}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-slate-900" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-2 text-center text-sm">
                      <Link href={`/dogs/${dog.slug}`} className="rounded-lg border px-3 py-2">Profile</Link>
                      <Link href={`/dogs/${dog.slug}/qr`} className="rounded-lg border px-3 py-2">QR</Link>
                      <Link href={`/dogs/${dog.slug}/edit`} className="rounded-lg border px-3 py-2">Edit</Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">v2.1 stabilization</h2>
          <p className="mt-2 text-slate-600">Focus: stable profile CRUD, QR page flow, mobile UX, and safer public pages before Buddy requests and Packs.</p>
        </article>
        <article className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Next layer</h2>
          <p className="mt-2 text-slate-600">Buddy requests, Packs, messaging, and nearby map discovery follow after this release is stable.</p>
        </article>
      </section>
    </main>
  );
}
