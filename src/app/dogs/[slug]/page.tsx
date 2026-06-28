import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';

export default async function DogProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dog = slug === 'demo' ? null : await prisma.dog.findUnique({ where: { slug }, include: { owner: true } });

  if (!dog && slug !== 'demo') notFound();

  const profile = dog ?? {
    name: 'Buddy',
    breed: 'Mixed breed',
    status: 'SAFE',
    medicalNotes: 'No known allergies',
    emergencyContact: '(555) 010-2026',
    owner: { displayName: 'Demo Owner' }
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="rounded-3xl border bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Public dog ID</p>
        <h1 className="mt-2 text-4xl font-bold">{profile.name}</h1>
        <p className="mt-2 text-slate-600">{profile.breed ?? 'Breed not listed'} · Owner: {profile.owner.displayName}</p>
        <div className="mt-6 rounded-xl bg-emerald-50 p-4 font-medium text-emerald-800">Status: {profile.status}</div>
        <dl className="mt-6 grid gap-4">
          <div><dt className="font-semibold">Medical notes</dt><dd className="text-slate-600">{profile.medicalNotes ?? 'None provided'}</dd></div>
          <div><dt className="font-semibold">Emergency contact</dt><dd className="text-slate-600">{profile.emergencyContact ?? 'Not provided'}</dd></div>
        </dl>
      </div>
    </main>
  );
}
