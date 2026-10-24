import { DogStatus } from '@/generated/prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { findDuplicateDog, normalizeDogName, uniqueDogSlug } from '@/lib/dogWrites';
import { cleanPlainText, optionalPlainText } from '@/lib/mutations';

function bool(value: FormDataEntryValue | null) {
  return value === 'on' || value === 'true';
}

function parseOptionalDate(raw: string) {
  if (!raw) return { valid: true, value: null as Date | null };
  const value = new Date(`${raw}T12:00:00.000Z`);
  return { valid: !Number.isNaN(value.getTime()), value: Number.isNaN(value.getTime()) ? null : value };
}

function parseOptionalInteger(raw: string, min: number, max: number) {
  if (!raw) return { valid: true, value: null as number | null };
  const value = Number(raw);
  const valid = Number.isInteger(value) && value >= min && value <= max;
  return { valid, value: valid ? value : null };
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

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const dogs = await prisma.dog.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50
  });
  return NextResponse.json({ data: dogs });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  try {
    const values = await request.formData();
    const name = normalizeDogName(values.get('name'));
    const birthDate = parseOptionalDate(cleanPlainText(values.get('birthDate'), 32));
    const weight = parseOptionalInteger(cleanPlainText(values.get('weightLbs'), 16), 1, 300);
    const photoUrl = parseOptionalUrl(cleanPlainText(values.get('photoUrl'), 2048));

    if (!name) return NextResponse.json({ error: 'Dog name is required.', field: 'name' }, { status: 400 });
    if (!birthDate.valid) return NextResponse.json({ error: 'Birth date is invalid.', field: 'birthDate' }, { status: 400 });
    if (!weight.valid) return NextResponse.json({ error: 'Weight must be between 1 and 300 lb.', field: 'weightLbs' }, { status: 400 });
    if (!photoUrl.valid) return NextResponse.json({ error: 'Photo URL is invalid.', field: 'photoUrl' }, { status: 400 });

    const duplicate = await findDuplicateDog(user.id, name);
    if (duplicate) {
      return NextResponse.json({ error: `A profile named ${duplicate.name} already exists.`, field: 'name', code: 'DUPLICATE_DOG' }, { status: 409 });
    }

    const dog = await prisma.dog.create({
      data: {
        ownerId: user.id,
        name,
        slug: await uniqueDogSlug(name),
        breed: optionalPlainText(values.get('breed'), 120),
        birthDate: birthDate.value,
        weightLbs: weight.value,
        gender: optionalPlainText(values.get('gender'), 40),
        photoUrl: photoUrl.value,
        status: parseStatus(cleanPlainText(values.get('status'), 16) || 'SAFE'),
        temperament: optionalPlainText(values.get('temperament'), 500),
        medicalNotes: optionalPlainText(values.get('medicalNotes'), 800),
        vaccinationNotes: optionalPlainText(values.get('vaccinationNotes'), 800),
        emergencyContact: optionalPlainText(values.get('emergencyContact'), 160),
        spayedNeutered: bool(values.get('spayedNeutered')),
        friendlyDogs: bool(values.get('friendlyDogs')),
        friendlyCats: bool(values.get('friendlyCats')),
        friendlyChildren: bool(values.get('friendlyChildren'))
      },
      select: { id: true, slug: true, name: true }
    });

    return NextResponse.json({ dog }, { status: 201 });
  } catch (error) {
    console.error('CREATE_DOG_FAILED', error);
    return NextResponse.json({ error: 'Dog profile could not be created.' }, { status: 500 });
  }
}
