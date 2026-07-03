import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function DogQrPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const { slug } = await params;
  const dog = await prisma.dog.findFirst({
    where: { slug, ownerId: user.id },
    select: { id: true, publicId: true, slug: true, name: true }
  });

  if (!dog) notFound();

  const qrId = dog.publicId ?? dog.id;
  const publicUrl = `/dogs/${dog.slug}`;
  const qrUrl = `/api/qr/${encodeURIComponent(qrId)}`;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-sm font-medium text-slate-500">Buddies V2</p>
      <h1 className="text-3xl font-bold">Code for {dog.name}</h1>
      <p className="mt-2 text-slate-600">Use this page to open the public profile code.</p>

      <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="rounded-xl border bg-white p-4">
          <img src={qrUrl} alt={`Public profile code for ${dog.name}`} className="mx-auto h-64 w-64" />
        </div>
        <div className="mt-6 grid gap-3">
          <Link href={publicUrl} className="rounded-lg bg-slate-900 px-4 py-3 text-center font-medium text-white">Open public page</Link>
          <a href={qrUrl} className="rounded-lg border px-4 py-3 text-center">Open SVG</a>
          <Link href={`/dogs/${dog.slug}/edit`} className="rounded-lg border px-4 py-3 text-center">Back to edit</Link>
        </div>
      </section>
    </main>
  );
}
