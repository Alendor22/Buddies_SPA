import { DogStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, slugify } from '@/lib/auth';
import { prisma } from '@/lib/db';

function valueFrom(values: URLSearchParams | FormData, key: string) {
  return String(values.get(key) ?? '').trim();
}

function bool(value: FormDataEntryValue | string | null) {
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

async function handleManage(request: NextRequest, values: URLSearchParams | FormData) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/auth/login', request.url));

  const id = valueFrom(values, 'id');
  const dog = await ownedDog(id, user.id);
  if (!dog) return NextResponse.redirect(new URL('/dashboard?error=dog-not-found', request.url));

  const intent = valueFrom(values, '_intent') || 'update';

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
        lastSeenLocation: valueFrom(values, 'lastSeenLocation') || null,
        lostReward: valueFrom(values, 'lostReward') || null,
        lostNotes: valueFrom(values, 'lostNotes') || null
      }
    });
    return NextResponse.redirect(new URL('/dashboard?lost=1', request.url));
  }

  if (intent === 'safe') {
    await prisma.dog.update({ where: { id }, data: { status: DogStatus.SAFE, lostSince: null, lostNotes: null, lostReward: null, lastSeenLocation: null } });
    return NextResponse.redirect(new URL('/dashboard?safe=1', request.url));
  }

  const name = valueFrom(values, 'name');
  if (!name) return NextResponse.redirect(new URL('/dashboard?error=name', request.url));

  const birthDateRaw = valueFrom(values, 'birthDate');
  const weightRaw = valueFrom(values, 'weightLbs');
  const statusRaw = (valueFrom(values, 'status') || 'SAFE') as keyof typeof DogStatus;

  const updated = await prisma.dog.update({
    where: { id },
    data: {
      name,
      slug: await uniqueSlug(name, id),
      breed: valueFrom(values, 'breed') || null,
      birthDate: birthDateRaw ? new Date(`${birthDateRaw}T12:00:00.000Z`) : null,
      weightLbs: weightRaw ? Number(weightRaw) : null,
      gender: valueFrom(values, 'gender') || null,
      photoUrl: valueFrom(values, 'photoUrl') || null,
      status: DogStatus[statusRaw] ?? DogStatus.SAFE,
      temperament: valueFrom(values, 'temperament') || null,
      medicalNotes: valueFrom(values, 'medicalNotes') || null,
      vaccinationNotes: valueFrom(values, 'vaccinationNotes') || null,
      emergencyContact: valueFrom(values, 'emergencyContact') || null,
      latitude: valueFrom(values, 'latitude') ? Number(valueFrom(values, 'latitude')) : null,
      longitude: valueFrom(values, 'longitude') ? Number(valueFrom(values, 'longitude')) : null,
      spayedNeutered: bool(values.get('spayedNeutered')),
      friendlyDogs: bool(values.get('friendlyDogs')),
      friendlyCats: bool(values.get('friendlyCats')),
      friendlyChildren: bool(values.get('friendlyChildren'))
    },
    select: { slug: true }
  });

  return NextResponse.redirect(new URL(`/dogs/${updated.slug}/edit?saved=1`, request.url));
}

export async function GET(request: NextRequest) {
  return handleManage(request, request.nextUrl.searchParams);
}

export async function POST(request: NextRequest) {
  return handleManage(request, await request.formData());
}
