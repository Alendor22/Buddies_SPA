import { NextRequest, NextResponse } from 'next/server';
import { DogStatus } from '@prisma/client';
import { getCurrentUser, slugify } from '@/lib/auth';
import { prisma } from '@/lib/db';

function bool(value: FormDataEntryValue | string | null) {
  return value === 'on' || value === 'true';
}

async function uniqueSlug(name: string) {
  const base = slugify(name) || 'dog';
  let slug = base;
  let index = 2;

  while (await prisma.dog.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${index}`;
    index += 1;
  }

  return slug;
}

async function getWritableUserId() {
  const currentUser = await getCurrentUser();
  if (currentUser?.id) return currentUser.id;

  const seededUser = await prisma.user.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true }
  });

  return seededUser?.id ?? null;
}

async function createDogFromValues(request: NextRequest, values: URLSearchParams | FormData) {
  const ownerId = await getWritableUserId();
  if (!ownerId) return NextResponse.redirect(new URL('/auth/register', request.url), { status: 303 });

  const name = String(values.get('name') ?? '').trim();
  if (!name) return NextResponse.redirect(new URL('/dogs/new?error=name', request.url), { status: 303 });

  const birthDateRaw = String(values.get('birthDate') ?? '').trim();
  const weightRaw = String(values.get('weightLbs') ?? '').trim();
  const statusRaw = String(values.get('status') ?? 'SAFE') as keyof typeof DogStatus;

  const dog = await prisma.dog.create({
    data: {
      ownerId,
      name,
      slug: await uniqueSlug(name),
      breed: String(values.get('breed') ?? '').trim() || null,
      birthDate: birthDateRaw ? new Date(`${birthDateRaw}T12:00:00.000Z`) : null,
      weightLbs: weightRaw ? Number(weightRaw) : null,
      gender: String(values.get('gender') ?? '').trim() || null,
      photoUrl: String(values.get('photoUrl') ?? '').trim() || null,
      status: DogStatus[statusRaw] ?? DogStatus.SAFE,
      temperament: String(values.get('temperament') ?? '').trim() || null,
      medicalNotes: String(values.get('medicalNotes') ?? '').trim() || null,
      vaccinationNotes: String(values.get('vaccinationNotes') ?? '').trim() || null,
      emergencyContact: String(values.get('emergencyContact') ?? '').trim() || null,
      spayedNeutered: bool(values.get('spayedNeutered')),
      friendlyDogs: bool(values.get('friendlyDogs')),
      friendlyCats: bool(values.get('friendlyCats')),
      friendlyChildren: bool(values.get('friendlyChildren'))
    },
    select: { slug: true }
  });

  return NextResponse.redirect(new URL(`/dogs/${dog.slug}/qr`, request.url), { status: 303 });
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get('create') === '1') {
    return createDogFromValues(request, request.nextUrl.searchParams);
  }

  const dogs = await prisma.dog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { owner: { select: { id: true, displayName: true } } }
  });
  return NextResponse.json({ data: dogs });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  return createDogFromValues(request, formData);
}
