import { DogStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, slugify } from '@/lib/auth';
import { prisma } from '@/lib/db';

function bool(value: FormDataEntryValue | null) {
  return value === 'on' || value === 'true';
}

async function uniqueSlug(name: string, currentId: string) {
  const base = slugify(name) || 'dog';
  let slug = base;
  let index = 2;

  while (true) {
    const existing = await prisma.dog.findUnique({ where: { slug }, select: { id: true } });
    if (!existing || existing.id === currentId) return slug;
    slug = `${base}-${index}`;
    index += 1;
  }
}

async function ownedDog(id: string, ownerId: string) {
  return prisma.dog.findFirst({ where: { id, ownerId }, select: { id: true } });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/auth/login', request.url));

  const formData = await request.formData();
  const id = String(formData.get('id') ?? '');
  const dog = await ownedDog(id, user.id);
  if (!dog) return NextResponse.redirect(new URL('/dashboard?error=dog-not-found', request.url));

  const intent = String(formData.get('_intent') ?? 'update');

  if (intent === 'remove') {
    await prisma.dog.delete({ where: { id } });
    return NextResponse.redirect(new URL('/dashboard?removed=1', request.url));
  }

  if (intent === 'lost') {
    await prisma.dog.update({
      where: { id },
      data: {
        status: DogStatus.LOST,
        lostSince: new Date(),
        lastSeenLocation: String(formData.get('lastSeenLocation') ?? '').trim() || null,
        lostReward: String(formData.get('lostReward') ?? '').trim() || null,
        lostNotes: String(formData.get('lostNotes') ?? '').trim() || null
      }
    });
    return NextResponse.redirect(new URL('/dashboard?lost=1', request.url));
  }

  if (intent === 'safe') {
    await prisma.dog.update({ where: { id }, data: { status: DogStatus.SAFE, lostSince: null, lostNotes: null, lostReward: null, lastSeenLocation: null } });
    return NextResponse.redirect(new URL('/dashboard?safe=1', request.url));
  }

  const name = String(formData.get('name') ?? '').trim();
  if (!name) return NextResponse.redirect(new URL('/dashboard?error=name', request.url));

  const birthDateRaw = String(formData.get('birthDate') ?? '').trim();
  const weightRaw = String(formData.get('weightLbs') ?? '').trim();
  const statusRaw = String(formData.get('status') ?? 'SAFE') as keyof typeof DogStatus;

  const updated = await prisma.dog.update({
    where: { id },
    data: {
      name,
      slug: await uniqueSlug(name, id),
      breed: String(formData.get('breed') ?? '').trim() || null,
      birthDate: birthDateRaw ? new Date(`${birthDateRaw}T12:00:00.000Z`) : null,
      weightLbs: weightRaw ? Number(weightRaw) : null,
      gender: String(formData.get('gender') ?? '').trim() || null,
      photoUrl: String(formData.get('photoUrl') ?? '').trim() || null,
      status: DogStatus[statusRaw] ?? DogStatus.SAFE,
      temperament: String(formData.get('temperament') ?? '').trim() || null,
      medicalNotes: String(formData.get('medicalNotes') ?? '').trim() || null,
      vaccinationNotes: String(formData.get('vaccinationNotes') ?? '').trim() || null,
      emergencyContact: String(formData.get('emergencyContact') ?? '').trim() || null,
      latitude: String(formData.get('latitude') ?? '').trim() ? Number(formData.get('latitude')) : null,
      longitude: String(formData.get('longitude') ?? '').trim() ? Number(formData.get('longitude')) : null,
      spayedNeutered: bool(formData.get('spayedNeutered')),
      friendlyDogs: bool(formData.get('friendlyDogs')),
      friendlyCats: bool(formData.get('friendlyCats')),
      friendlyChildren: bool(formData.get('friendlyChildren'))
    },
    select: { slug: true }
  });

  return NextResponse.redirect(new URL(`/dogs/${updated.slug}`, request.url));
}
