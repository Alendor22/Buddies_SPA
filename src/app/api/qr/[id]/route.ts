import QRCode from 'qrcode';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const decodedId = decodeURIComponent(id || '').trim();

  if (!decodedId) {
    return Response.json({ ok: false, error: 'Missing QR id' }, { status: 400 });
  }

  const dog = await prisma.dog.findFirst({
    where: {
      OR: [
        { id: decodedId },
        { publicId: decodedId },
        { publicId: decodedId.toUpperCase() },
        { slug: decodedId.toLowerCase() }
      ]
    },
    select: { slug: true }
  });

  const origin = new URL(request.url).origin;
  const targetUrl = dog ? `${origin}/dogs/${dog.slug}` : `${origin}/dogs/${encodeURIComponent(decodedId.toLowerCase())}`;
  const format = new URL(request.url).searchParams.get('format')?.toLowerCase();

  const options = {
    errorCorrectionLevel: 'M' as const,
    margin: 2,
    width: 512,
    color: {
      dark: '#0f172a',
      light: '#ffffff'
    }
  };

  if (format === 'svg') {
    const svgBody = await QRCode.toString(targetUrl, {
      ...options,
      type: 'svg'
    });
    const svg = svgBody.startsWith('<?xml') ? svgBody : `<?xml version="1.0" encoding="UTF-8"?>\n${svgBody}`;

    return new Response(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  }

  const png = await QRCode.toBuffer(targetUrl, {
    ...options,
    type: 'png'
  });

  return new Response(png, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store, max-age=0'
    }
  });
}
