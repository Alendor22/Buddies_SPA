import QRCode from 'qrcode';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import DogQrActions from '@/components/DogQrActions';
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

  const publicPath = `/dogs/${dog.slug}`;
  const publicUrl = `https://buddies.vercel.app${publicPath}`;

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

  const responsiveSvg = svg.replace('<svg ', '<svg class="block h-auto w-full max-w-[280px] sm:max-w-[360px] print:max-w-[480px]" role="img" aria-label="Buddies public profile QR code" ');

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 print:max-w-none print:px-0">
      <div className="print:text-center">
        <p className="text-sm font-medium text-slate-500 print:hidden">Buddies V2</p>
        <h1 className="text-3xl font-bold">Code for {dog.name}</h1>
        <p className="mt-2 text-slate-600 print:hidden">Use this page to open the public profile code.</p>
      </div>

      <section className="mt-8 rounded-2xl border bg-white p-4 shadow-sm sm:p-6 print:border-0 print:shadow-none">
        <div className="flex justify-center overflow-hidden rounded-xl border bg-white p-4 print:border-0" dangerouslySetInnerHTML={{ __html: responsiveSvg }} />
        <p className="mt-3 break-all text-center text-sm text-slate-500">{publicUrl}</p>
        <DogQrActions dogName={dog.name} publicUrl={publicUrl} svg={svg} />
        <Link href={`/dogs/${dog.slug}/edit`} className="mt-3 block rounded-lg border px-4 py-3 text-center print:hidden">Back to edit</Link>
      </section>
    </main>
  );
}
