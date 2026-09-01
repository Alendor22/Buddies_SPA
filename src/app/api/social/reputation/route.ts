import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getReputation } from '@/lib/social/repository';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  return NextResponse.json({ score: await getReputation(user.id) });
}
