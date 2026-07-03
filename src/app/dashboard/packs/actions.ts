'use server';

import { PackRole } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { DEMO_USER_ID } from '@/lib/demo-user';

export async function joinPack(formData: FormData) {
  const packId = String(formData.get('packId') ?? '');
  if (!packId) return;

  const dog = await prisma.dog.findFirst({ where: { ownerId: DEMO_USER_ID }, orderBy: { createdAt: 'asc' } });

  await prisma.packMembership.upsert({
    where: { packId_userId: { packId, userId: DEMO_USER_ID } },
    update: { role: PackRole.MEMBER, dogId: dog?.id ?? null },
    create: { packId, userId: DEMO_USER_ID, dogId: dog?.id ?? null, role: PackRole.MEMBER }
  });

  revalidatePath('/dashboard/packs');
}

export async function leavePack(formData: FormData) {
  const packId = String(formData.get('packId') ?? '');
  if (!packId) return;

  await prisma.packMembership.deleteMany({ where: { packId, userId: DEMO_USER_ID } });
  revalidatePath('/dashboard/packs');
}
