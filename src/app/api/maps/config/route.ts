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

  // The token is a public (pk.*) key that only changes on redeploy — safe to let the
  // browser reuse it for a few minutes instead of re-fetching on every page load.
  return NextResponse.json(
    { ready: true, token },
    {
      headers: {
        'Cache-Control': 'private, max-age=300'
      }
    }
  );
}
