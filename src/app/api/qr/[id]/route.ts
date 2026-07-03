import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const cleanId = encodeURIComponent(id || 'dog');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="white"/><rect x="48" y="48" width="120" height="120" fill="#0f172a"/><rect x="344" y="48" width="120" height="120" fill="#0f172a"/><rect x="48" y="344" width="120" height="120" fill="#0f172a"/><rect x="84" y="84" width="48" height="48" fill="white"/><rect x="380" y="84" width="48" height="48" fill="white"/><rect x="84" y="380" width="48" height="48" fill="white"/><text x="256" y="250" text-anchor="middle" font-family="Arial" font-size="32" font-weight="700" fill="#0f172a">Buddies</text><text x="256" y="296" text-anchor="middle" font-family="Arial" font-size="18" fill="#475569">${cleanId}</text></svg>`;

  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}
