import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function safeText(value: string) {
  return value.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char] ?? char));
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const publicUrl = new URL(`/d/${encodeURIComponent(id)}`, request.url).toString();
  const label = safeText(publicUrl);
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">',
    '<rect width="512" height="512" fill="white"/>',
    '<rect x="48" y="48" width="120" height="120" fill="#0f172a"/>',
    '<rect x="344" y="48" width="120" height="120" fill="#0f172a"/>',
    '<rect x="48" y="344" width="120" height="120" fill="#0f172a"/>',
    '<rect x="84" y="84" width="48" height="48" fill="white"/>',
    '<rect x="380" y="84" width="48" height="48" fill="white"/>',
    '<rect x="84" y="380" width="48" height="48" fill="white"/>',
    '<text x="256" y="250" text-anchor="middle" font-family="Arial" font-size="28" font-weight="700" fill="#0f172a">Buddies</text>',
    `<text x="256" y="292" text-anchor="middle" font-family="Arial" font-size="14" fill="#475569">${label}</text>`,
    '</svg>'
  ].join('');

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Content-Disposition': `inline; filename="buddies-${id}.svg"`,
      'Cache-Control': 'no-store'
    }
  });
}
