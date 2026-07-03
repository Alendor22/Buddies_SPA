import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

function safeText(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char] ?? char));
}

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
  const label = safeText(qrId);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="white"/><rect x="48" y="48" width="120" height="120" fill="#0f172a"/><rect x="344" y="48" width="120" height="120" fill="#0f172a"/><rect x="48" y="344" width="120" height="120" fill="#0f172a"/><rect x="84" y="84" width="48" height="48" fill="white"/><rect x="380" y="84" width="48" height="48" fill="white"/><rect x="84" y="380" width="48" height="48" fill="white"/><text x="256" y="244" text-anchor="middle" font-family="Arial" font-size="34" font-weight="700" fill="#0f172a">Buddies</text><text x="256" y="292" text-anchor="middle" font-family="Arial" font-size="18" fill="#475569">${label}</text></svg>`;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-sm font-medium text-slate-500">Buddies V2</p>
      <h1 className="text-3xl font-bold">Code for {dog.name}</h1>
      <p className="mt-2 text-slate-600">Use this page to open the public profile code.</p>

      <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="rounded-xl border bg-white p-4" dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="mt-6 grid gap-3">
          <Link href={publicUrl} className="rounded-lg bg-slate-900 px-4 py-3 text-center font-medium text-white">Open public page</Link>
          <a href={qrUrl} className="rounded-lg border px-4 py-3 text-center">Open SVG</a>
          <Link href={`/dogs/${dog.slug}/edit`} className="rounded-lg border px-4 py-3 text-center">Back to edit</Link>
        </div>
      </section>
    </main>
  );
}
