import { NextResponse } from 'next/server';
import { getMapboxToken, getPublicMapboxToken } from '@/lib/mapboxToken';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const token = getPublicMapboxToken();

  if (!token) {
    const configured = getMapboxToken();
    const error = configured
      ? 'The configured Mapbox token is not browser-safe. Use a public token beginning with pk.'
      : 'Mapbox token not found in this Vercel Production deployment.';

    return NextResponse.json(
      { ready: false, error },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'CDN-Cache-Control': 'no-store',
          'Vercel-CDN-Cache-Control': 'no-store'
        }
      }
    );
  }

  return NextResponse.json(
    { ready: true, token },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'CDN-Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store'
      }
    }
  );
}
