import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, slugify } from '@/lib/auth';
import { prisma } from '@/lib/db';

function cleanSlug(value: string) {
  const trimmed = value.trim();
  if (trimmed.includes('/dogs/')) {
    const [, tail = ''] = trimmed.split('/dogs/');
    return slugify(tail.split('/')[0] ?? '');
  }
  return slugify(trimmed);
}

async function handleClaim(request: NextRequest, values: URLSearchParams | FormData) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/auth/login', request.url));

  const slug = cleanSlug(String(values.get('slug') ?? values.get('profile') ?? ''));
  if (!slug) return NextResponse.redirect(new URL('/dashboard?claim=missing', request.url));

  const dog = await prisma.dog.findUnique({
    where: { slug },
    select: { id: true, ownerId: true }
  });

  if (!dog) return NextResponse.redirect(new URL('/dashboard?claim=not-found', request.url));

  if (dog.ownerId !== user.id) {
    const revokedAt = new Date();
    await prisma.$transaction([
      prisma.dog.update({ where: { id: dog.id }, data: { ownerId: user.id } }),
      prisma.recognitionEnrollment.updateMany({
        where: { dogId: dog.id },
        data: {
          ownerId: user.id,
          status: 'REVOKED',
          revokedAt,
          activatedAt: null,
          modelVersion: null
        }
      })
    ]);
  }

  return NextResponse.redirect(new URL('/dashboard?claim=success', request.url));
}

export async function GET(request: NextRequest) {
  return handleClaim(request, request.nextUrl.searchParams);
}

export async function POST(request: NextRequest) {
  return handleClaim(request, await request.formData());
}
