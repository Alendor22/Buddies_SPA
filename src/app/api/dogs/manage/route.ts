import { DogStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, slugify } from '@/lib/auth';
import { prisma } from '@/lib/db';

function valueFrom(values: FormData, key: string) {
  return String(values.get(key) ?? '').trim();
}

function bool(value: FormDataEntryValue | null) {
  return value === 'on' || value === 'true';
}

function parseOptionalNumber(raw: string, min: number, max: number, integer = false) {
  if (!raw) return { valid: true, value: null as number | null };
  const value = Number(raw);
  const valid = Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value));
  return { valid, value: valid ? value : null };
}

function parseOptionalDate(raw: string) {
  if (!raw) return { valid: true, value: null as Date | null };
  const value = new Date(`${raw}T12:00:00.000Z`);
  return { valid: !Number.isNaN(value.getTime()), value: Number.isNaN(value.getTime()) ? null : value };
}

function parseOptionalUrl(raw: string) {
  if (!raw) return { valid: true, value: null as string | null };
  try {
    const value = new URL(raw);
    const valid = value.protocol === 'https:' || value.protocol === 'http:';
    return { valid, value: valid ? value.toString() : null };
  } catch {
    return { valid: false, value: null };
  }
}

function parseStatus(raw: string) {
  return Object.values(DogStatus).includes(raw as DogStatus) ? raw as DogStatus : DogStatus.SAFE;
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

function redirectToEdit(request: NextRequest, slug: string, query = '') {
  const suffix = query ? `&${query}` : '';
  return NextResponse.redirect(new URL(`/dogs/edit?slug=${encodeURIComponent(slug)}${suffix}`, request.url), 303);
}

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL('/dogs', request.url), 303);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/auth/login', request.url), 303);

  const values = await request.formData();
  const id = valueFrom(values, 'id');
  const dog = await prisma.dog.findFirst({ where: { id, ownerId: user.id }, select: { id: true, slug: true } });
  if (!dog) return NextResponse.redirect(new URL('/dashboard?error=dog-not-found', request.url), 303);

  const intent = valueFrom(values, '_intent') || 'update';

  if (intent === 'remove') {
    await prisma.dog.delete({ where: { id: dog.id } });
    return NextResponse.redirect(new URL('/dashboard?removed=1', request.url), 303);
  }

  if (intent === 'lost') {
    await prisma.dog.update({
      where: { id: dog.id },
      data: {
        status: DogStatus.LOST,
        lostSince: new Date(),
        lastSeenLocation: valueFrom(values, 'lastSeenLocation').slice(0, 240) || null,
        lostReward: valueFrom(values, 'lostReward').slice(0, 160) || null,
        lostNotes: valueFrom(values, 'lostNotes').slice(0, 1000) || null
      }
    });
    return NextResponse.redirect(new URL('/dashboard?lost=1', request.url), 303);
  }

  if (intent === 'safe') {
    await prisma.dog.update({
      where: { id: dog.id },
      data: { status: DogStatus.SAFE, lostSince: null, lostNotes: null, lostReward: null, lastSeenLocation: null }
    });
    return NextResponse.redirect(new URL('/dashboard?safe=1', request.url), 303);
  }

  const name = valueFrom(values, 'name');
  const birthDate = parseOptionalDate(valueFrom(values, 'birthDate'));
  const weight = parseOptionalNumber(valueFrom(values, 'weightLbs'), 1, 300, true);
  const latitude = parseOptionalNumber(valueFrom(values, 'latitude'), -90, 90);
  const longitude = parseOptionalNumber(valueFrom(values, 'longitude'), -180, 180);
  const photoUrl = parseOptionalUrl(valueFrom(values, 'photoUrl'));

  if (!name || name.length > 80 || !birthDate.valid || !weight.valid || !latitude.valid || !longitude.valid || !photoUrl.valid) {
    return redirectToEdit(request, dog.slug, 'error=invalid');
  }

  const updated = await prisma.dog.update({
    where: { id: dog.id },
    data: {
      name,
      slug: await uniqueSlug(name, dog.id),
      breed: valueFrom(values, 'breed').slice(0, 120) || null,
      birthDate: birthDate.value,
      weightLbs: weight.value,
      gender: valueFrom(values, 'gender').slice(0, 40) || null,
      photoUrl: photoUrl.value,
      status: parseStatus(valueFrom(values, 'status') || 'SAFE'),
      temperament: valueFrom(values, 'temperament').slice(0, 500) || null,
      medicalNotes: valueFrom(values, 'medicalNotes').slice(0, 800) || null,
      vaccinationNotes: valueFrom(values, 'vaccinationNotes').slice(0, 800) || null,
      emergencyContact: valueFrom(values, 'emergencyContact').slice(0, 160) || null,
      latitude: latitude.value,
      longitude: longitude.value,
      spayedNeutered: bool(values.get('spayedNeutered')),
      friendlyDogs: bool(values.get('friendlyDogs')),
      friendlyCats: bool(values.get('friendlyCats')),
      friendlyChildren: bool(values.get('friendlyChildren'))
    },
    select: { slug: true }
  });

  return redirectToEdit(request, updated.slug, 'saved=1');
}
