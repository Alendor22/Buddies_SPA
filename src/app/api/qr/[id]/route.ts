import QRCode from 'qrcode';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const decodedId = decodeURIComponent(id || '').trim();

  if (!decodedId) {
    return NextResponse.json({ ok: false, error: 'Missing QR id' }, { status: 400 });
  }

  const dog = await prisma.dog.findFirst({
    where: {
      OR: [
        { id: decodedId },
        { publicId: decodedId },
        { slug: decodedId }
      ]
    },
    select: { slug: true }
  });

  const origin = new URL(request.url).origin;
  const targetUrl = dog ? `${origin}/dogs/${dog.slug}` : `${origin}/dogs/${encodeURIComponent(decodedId)}`;

  const svg = await QRCode.toString(targetUrl, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 512,
    color: {
      dark: '#0f172a',
      light: '#ffffff'
    }
  });

  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}
