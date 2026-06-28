import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

const dogSchema = z.object({
  ownerId: z.string().min(1),
  name: z.string().min(1).max(80),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  breed: z.string().max(120).optional()
});

export async function GET() {
  const dogs = await prisma.dog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  return NextResponse.json({ data: dogs });
}

export async function POST(request: Request) {
  const parsed = dogSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const dog = await prisma.dog.create({ data: parsed.data });
  return NextResponse.json({ data: dog }, { status: 201 });
}
