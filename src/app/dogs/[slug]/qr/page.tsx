import QRCode from 'qrcode';
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
  const publicPath = `/dogs/${dog.slug}`;
  const publicUrl = `https://buddies.vercel.app${publicPath}`;
  const qrUrl = `/api/qr/${encodeURIComponent(qrId)}`;
  const absoluteQrUrl = `https://buddies.vercel.app${qrUrl}`;

  const svg = await QRCode.toString(publicUrl, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 512,
    color: {
      dark: '#0f172a',
      light: '#ffffff'
    }
  });

  const responsiveSvg = svg.replace('<svg ', '<svg class="block h-auto w-full max-w-[280px] sm:max-w-[360px]" role="img" aria-label="Buddies public profile QR code" ');

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="text-sm font-medium text-slate-500">Buddies V2</p>
      <h1 className="text-3xl font-bold">Code for {dog.name}</h1>
      <p className="mt-2 text-slate-600">Use this page to open the public profile code.</p>

      <section className="mt-8 rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
        <div className="flex justify-center rounded-xl border bg-white p-4 overflow-hidden" dangerouslySetInnerHTML={{ __html: responsiveSvg }} />
        <p className="mt-3 break-all text-center text-sm text-slate-500">{publicUrl}</p>
        <div className="mt-6 grid gap-3">
          <Link href={publicPath} className="rounded-lg bg-slate-900 px-4 py-3 text-center font-medium text-white">Open public page</Link>
          <Link href={qrUrl} className="rounded-lg border px-4 py-3 text-center">Open SVG</Link>
          <p className="break-all text-xs text-slate-500">SVG URL: {absoluteQrUrl}</p>
          <Link href={`/dogs/${dog.slug}/edit`} className="rounded-lg border px-4 py-3 text-center">Back to edit</Link>
        </div>
      </section>
    </main>
  );
}
