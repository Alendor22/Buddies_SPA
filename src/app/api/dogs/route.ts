import { NextRequest, NextResponse } from 'next/server';
import { DogStatus } from '@prisma/client';
import { slugify } from '@/lib/auth';
import { prisma } from '@/lib/db';

function bool(value: FormDataEntryValue | string | null) {
  return value === 'on' || value === 'true';
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function htmlResponse(title: string, message: string, href: string, linkText: string, status = 200) {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const safeHref = escapeHtml(href);
  const safeLinkText = escapeHtml(linkText);

  return new Response(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="0;url=${safeHref}" />
  <title>${safeTitle}</title>
  <style>
    body{margin:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f8fafc;color:#0f172a;display:grid;min-height:100vh;place-items:center;padding:24px}
    main{max-width:520px;border:1px solid #e2e8f0;background:white;border-radius:24px;padding:28px;box-shadow:0 8px 30px rgba(15,23,42,.08)}
    p{color:#475569;font-size:18px;line-height:1.5}a{display:inline-block;margin-top:16px;background:#0f172a;color:white;text-decoration:none;border-radius:14px;padding:14px 18px;font-weight:700}
  </style>
</head>
<body>
  <main>
    <p style="font-size:14px;font-weight:700;color:#64748b">Buddies V2.2 Add Dog Confirm Fix</p>
    <h1>${safeTitle}</h1>
    <p>${safeMessage}</p>
    <a href="${safeHref}">${safeLinkText}</a>
  </main>
</body>
</html>`, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
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
  const seededUser = await prisma.user.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true }
  });

  if (seededUser?.id) return seededUser.id;

  const fallbackUser = await prisma.user.create({
    data: {
      email: 'demo@buddies.local',
      displayName: 'Adeja'
    },
    select: { id: true }
  });

  return fallbackUser.id;
}

async function createDogFromValues(request: NextRequest, values: URLSearchParams | FormData) {
  try {
    const ownerId = await getWritableUserId();
    const name = String(values.get('name') ?? '').trim();
    if (!name) return htmlResponse('Dog name required', 'Go back and enter a dog name.', '/dogs/new?error=name', 'Back to Add Dog', 400);

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
      select: { slug: true, name: true }
    });

    const qrPath = `/dogs/${dog.slug}/qr`;
    return htmlResponse('Dog profile created', `${dog.name} was created. Opening the QR page now.`, qrPath, 'Open QR page');
  } catch (error) {
    console.error('CREATE_DOG_FAILED', error);
    return htmlResponse('Create dog failed', 'The server could not create this dog profile. Return to the form and try again.', '/dogs/new?error=create', 'Back to Add Dog', 500);
  }
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
