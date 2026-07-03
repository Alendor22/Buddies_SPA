import QRCode from 'qrcode';
import { NextResponse } from 'next/server';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const publicUrl = new URL(`/d/${encodeURIComponent(id)}`, request.url).toString();
  const svg = await QRCode.toString(publicUrl, {
    type: 'svg',
    margin: 2,
    width: 512,
    errorCorrectionLevel: 'M'
  });

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Content-Disposition': `inline; filename="buddies-${id}.svg"`,
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
