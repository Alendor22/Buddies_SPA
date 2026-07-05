import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DogStatus } from '@prisma/client';
import { getCurrentUser, slugify } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

type ConfirmParams = {
  name?: string;
  breed?: string;
  birthDate?: string;
  weightLbs?: string;
  gender?: string;
  status?: string;
  photoUrl?: string;
  temperament?: string;
  vaccinationNotes?: string;
  medicalNotes?: string;
  emergencyContact?: string;
  spayedNeutered?: string;
  friendlyDogs?: string;
  friendlyCats?: string;
  friendlyChildren?: string;
};

function bool(value?: string) {
  return value === 'on' || value === 'true';
}

async function uniqueSlug(name: string) {
  const base = slugify(name) || 'new-buddy';
  let slug = base;
  let index = 2;

  while (await prisma.dog.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${index}`;
    index += 1;
  }

  return slug;
}

export default async function ConfirmNewDogPage({ searchParams }: { searchParams: Promise<ConfirmParams> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const values = await searchParams;
  const name = String(values.name ?? '').trim() || 'New Buddy';
  const birthDateRaw = String(values.birthDate ?? '').trim();
  const weightRaw = String(values.weightLbs ?? '').trim();
  const statusRaw = String(values.status ?? 'SAFE') as keyof typeof DogStatus;

  const dog = await prisma.dog.create({
    data: {
      ownerId: user.id,
      name,
      slug: await uniqueSlug(name),
      breed: String(values.breed ?? '').trim() || null,
      birthDate: birthDateRaw ? new Date(`${birthDateRaw}T12:00:00.000Z`) : null,
      weightLbs: weightRaw ? Number(weightRaw) : null,
      gender: String(values.gender ?? '').trim() || null,
      photoUrl: String(values.photoUrl ?? '').trim() || null,
      status: DogStatus[statusRaw] ?? DogStatus.SAFE,
      temperament: String(values.temperament ?? '').trim() || null,
      medicalNotes: String(values.medicalNotes ?? '').trim() || null,
      vaccinationNotes: String(values.vaccinationNotes ?? '').trim() || null,
      emergencyContact: String(values.emergencyContact ?? '').trim() || null,
      spayedNeutered: bool(values.spayedNeutered),
      friendlyDogs: bool(values.friendlyDogs),
      friendlyCats: bool(values.friendlyCats),
      friendlyChildren: bool(values.friendlyChildren)
    },
    select: { name: true, slug: true }
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <p className="text-sm font-medium text-slate-500">Buddies V2.2 Account-Bound Dog Create</p>
      <h1 className="mt-2 text-3xl font-bold">Dog profile created</h1>
      <p className="mt-3 text-slate-600">{dog.name} was created under {user.email}. It will now appear on your dashboard.</p>
      <Link href="/dashboard" className="mt-6 rounded-lg bg-slate-900 px-5 py-3 text-center font-medium text-white">Back to dashboard</Link>
      <Link href={`/dogs/${dog.slug}/edit`} className="mt-3 rounded-lg border px-5 py-3 text-center font-medium">Edit attributes</Link>
      <Link href={`/dogs/${dog.slug}/qr`} className="mt-3 rounded-lg border px-5 py-3 text-center font-medium">Open QR page</Link>
    </main>
  );
}
