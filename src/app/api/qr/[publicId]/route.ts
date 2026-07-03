import { NextRequest } from 'next/server';

function codeBits(value: string) {
  let seed = 0;
  for (const char of value) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  return seed;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const host = request.headers.get('host') ?? 'buddies.vercel.app';
  const target = `https://${host}/d/${encodeURIComponent(publicId)}`;
  const seed = codeBits(target);
  const cell = 8;
  const count = 25;
  const total = cell * count;
  const rects: string[] = [];

  for (let y = 0; y < count; y += 1) {
    for (let x = 0; x < count; x += 1) {
      const finder = (x < 7 && y < 7) || (x > 17 && y < 7) || (x < 7 && y > 17);
      const finderOn = finder && (x % 6 === 0 || y % 6 === 0 || (x % 6 >= 2 && x % 6 <= 4 && y % 6 >= 2 && y % 6 <= 4));
      const dataOn = !finder && (((seed + x * 17 + y * 31 + x * y) >> ((x + y) % 12)) & 1) === 1;
      if (finderOn || dataOn) rects.push(`<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}"/>`);
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}"><rect width="${total}" height="${total}" fill="white"/><g fill="#0f172a">${rects.join('')}</g></svg>`;
  return new Response(svg, { headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
