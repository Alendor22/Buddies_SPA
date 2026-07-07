import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getMapboxToken, getPublicMapboxToken } from '@/lib/mapboxToken';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const token = getPublicMapboxToken();
  if (!token) {
    const configured = getMapboxToken();
    const error = configured
      ? 'The configured Mapbox token is not a public token. Use a token beginning with pk.'
      : 'Mapbox token not found in the current Vercel deployment.';

    return NextResponse.json(
      { error },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  return NextResponse.json(
    { token },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
