import { slugify } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { cleanPlainText } from '@/lib/mutations';

export function normalizeDogName(value: unknown) {
  return cleanPlainText(value, 80).replace(/\s+/g, ' ');
}

export async function findDuplicateDog(ownerId: string, name: string, excludeId?: string) {
  return prisma.dog.findFirst({
    where: {
      ownerId,
      name: { equals: name, mode: 'insensitive' },
      ...(excludeId ? { id: { not: excludeId } } : {})
    },
    select: { id: true, slug: true, name: true }
  });
}

export async function uniqueDogSlug(name: string, currentId?: string) {
  const base = slugify(name) || 'dog';
  let slug = base;
  let suffix = 2;

  while (true) {
    const existing = await prisma.dog.findUnique({ where: { slug }, select: { id: true } });
    if (!existing || existing.id === currentId) return slug;
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
}
