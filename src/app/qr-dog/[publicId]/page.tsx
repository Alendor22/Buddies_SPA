import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function PublicDogIdPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const dog = await prisma.dog.findFirst({ where: { OR: [{ publicId }, { id: publicId }] }, select: { slug: true } });
  if (!dog) notFound();
  redirect(`/dogs/${dog.slug}`);
}
