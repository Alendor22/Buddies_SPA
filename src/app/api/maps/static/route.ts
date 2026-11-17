import { NextRequest, NextResponse } from 'next/server';
import { getMapboxToken } from '@/lib/mapboxToken';
import { clientIdentifier, rateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function numberParam(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function fallbackSvg(latitude: number, longitude: number, width: number, height: number) {
  const safeWidth = Math.round(width);
  const safeHeight = Math.round(height);
  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${safeWidth}" height="${safeHeight}" viewBox="0 0 ${safeWidth} ${safeHeight}">
    <rect width="100%" height="100%" fill="#eef2f7"/>
    <defs>
      <pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse">
        <path d="M 36 0 L 0 0 0 36" fill="none" stroke="#cbd5e1" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid)"/>
    <path d="M -40 ${safeHeight * 0.35} L ${safeWidth + 40} ${safeHeight * 0.58}" stroke="#ffffff" stroke-width="38" stroke-linecap="round" opacity="0.9"/>
    <path d="M ${safeWidth * 0.2} -40 L ${safeWidth * 0.62} ${safeHeight + 40}" stroke="#ffffff" stroke-width="28" stroke-linecap="round" opacity="0.82"/>
    <rect x="18" y="18" width="${Math.min(340, safeWidth - 36)}" height="54" rx="12" fill="#ffffff" opacity="0.94"/>
    <text x="34" y="42" font-family="system-ui, sans-serif" font-size="14" font-weight="700" fill="#0f172a">Street map temporarily unavailable</text>
    <text x="34" y="61" font-family="system-ui, sans-serif" font-size="12" fill="#475569">${latitude.toFixed(6)}, ${longitude.toFixed(6)}</text>
  </svg>`;
}

export async function GET(request: NextRequest) {
  const limit = await rateLimit('maps:static', clientIdentifier(request.headers.get('x-forwarded-for')), 60, 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many requests.' }, {
      status: 429,
      headers: { 'Retry-After': String(limit.retryAfterSeconds) }
    });
  }

  const latitude = numberParam(request.nextUrl.searchParams.get('lat'), 40.685743, -90, 90);
  const longitude = numberParam(request.nextUrl.searchParams.get('lng'), -73.941329, -180, 180);
  const zoom = numberParam(request.nextUrl.searchParams.get('zoom'), 14, 0, 22);
  const width = numberParam(request.nextUrl.searchParams.get('width'), 640, 200, 1280);
  const height = numberParam(request.nextUrl.searchParams.get('height'), 640, 200, 1280);
  const token = getMapboxToken();

  if (!token) {
    return new NextResponse(fallbackSvg(latitude, longitude, width, height), {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=60'
      }
    });
  }

  const size = `${Math.round(width)}x${Math.round(height)}`;
  const mapUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${longitude},${latitude},${zoom},0/${size}?access_token=${encodeURIComponent(token)}`;
  const response = await fetch(mapUrl, { next: { revalidate: 300 } });

  if (!response.ok) {
    return new NextResponse(fallbackSvg(latitude, longitude, width, height), {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=60'
      }
    });
  }

  return new NextResponse(await response.arrayBuffer(), {
    status: 200,
    headers: {
      'Content-Type': response.headers.get('content-type') || 'image/png',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600'
    }
  });
}
