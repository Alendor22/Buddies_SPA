import { DogStatus } from '@/generated/prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { findDuplicateDog, normalizeDogName } from '@/lib/dogWrites';
import { cleanPlainText, mapPrismaWriteError, optionalPlainText } from '@/lib/mutations';

function valueFrom(values: FormData, key: string) {
  return cleanPlainText(values.get(key), 4000);
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

function redirectToEdit(request: NextRequest, slug: string, query = '') {
  const suffix = query ? `&${query}` : '';
  return NextResponse.redirect(new URL(`/dogs/edit?slug=${encodeURIComponent(slug)}${suffix}`, request.url), 303);
}

function validationRedirect(request: NextRequest, slug: string, field: string) {
  return redirectToEdit(request, slug, `error=${encodeURIComponent(field)}`);
}

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL('/dogs', request.url), 303);
}

export async function POST(request: NextRequest) {
  let dogSlug = '';
  let dogId = '';
  let intent = 'update';

  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.redirect(new URL('/auth/login', request.url), 303);

    const values = await request.formData();
    dogId = cleanPlainText(values.get('id'), 64);
    const dog = await prisma.dog.findFirst({ where: { id: dogId, ownerId: user.id }, select: { id: true, slug: true } });
    if (!dog) return NextResponse.redirect(new URL('/dogs?error=dog-not-found', request.url), 303);

    dogSlug = dog.slug;
    intent = cleanPlainText(values.get('_intent'), 24) || 'update';

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
          lastSeenLocation: optionalPlainText(values.get('lastSeenLocation'), 240),
          lostReward: optionalPlainText(values.get('lostReward'), 160),
          lostNotes: optionalPlainText(values.get('lostNotes'), 1000)
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

    const name = normalizeDogName(values.get('name'));
    const birthDate = parseOptionalDate(valueFrom(values, 'birthDate'));
    const weight = parseOptionalNumber(valueFrom(values, 'weightLbs'), 1, 300, true);
    const latitude = parseOptionalNumber(valueFrom(values, 'latitude'), -90, 90);
    const longitude = parseOptionalNumber(valueFrom(values, 'longitude'), -180, 180);
    const photoUrl = parseOptionalUrl(valueFrom(values, 'photoUrl'));

    if (!name) return validationRedirect(request, dog.slug, 'name');
    if (!birthDate.valid) return validationRedirect(request, dog.slug, 'birthDate');
    if (!weight.valid) return validationRedirect(request, dog.slug, 'weightLbs');
    if (!photoUrl.valid) return validationRedirect(request, dog.slug, 'photoUrl');
    if (!latitude.valid) return validationRedirect(request, dog.slug, 'latitude');
    if (!longitude.valid) return validationRedirect(request, dog.slug, 'longitude');

    const duplicate = await findDuplicateDog(user.id, name, dog.id);
    if (duplicate) return validationRedirect(request, dog.slug, 'duplicateName');

    await prisma.dog.update({
      where: { id: dog.id },
      data: {
        name,
        breed: optionalPlainText(values.get('breed'), 120),
        birthDate: birthDate.value,
        weightLbs: weight.value,
        gender: optionalPlainText(values.get('gender'), 40),
        photoUrl: photoUrl.value,
        status: parseStatus(valueFrom(values, 'status') || 'SAFE'),
        temperament: optionalPlainText(values.get('temperament'), 500),
        medicalNotes: optionalPlainText(values.get('medicalNotes'), 800),
        vaccinationNotes: optionalPlainText(values.get('vaccinationNotes'), 800),
        emergencyContact: optionalPlainText(values.get('emergencyContact'), 160),
        latitude: latitude.value,
        longitude: longitude.value,
        spayedNeutered: bool(values.get('spayedNeutered')),
        friendlyDogs: bool(values.get('friendlyDogs')),
        friendlyCats: bool(values.get('friendlyCats')),
        friendlyChildren: bool(values.get('friendlyChildren'))
      }
    });

    return redirectToEdit(request, dog.slug, 'saved=1');
  } catch (error) {
    console.error('dog write failed', { dogId, intent, error });
    if (!dogSlug) return NextResponse.redirect(new URL('/dogs?error=save', request.url), 303);
    const failure = mapPrismaWriteError(error);
    const code = encodeURIComponent(failure.code ?? 'INTERNAL_ERROR');
    return redirectToEdit(request, dogSlug, `error=form&code=${code}`);
  }
}
