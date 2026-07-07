import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.MAPBOX_ACCESS_TOKEN || '';
  if (!token.startsWith('pk.')) {
    return NextResponse.json({ error: 'A Mapbox public token beginning with pk. is required.' }, { status: 503 });
  }

  return NextResponse.json({ token });
}
