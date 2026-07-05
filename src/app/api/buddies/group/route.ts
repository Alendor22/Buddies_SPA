import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/auth/login', request.url));
  const formData = await request.formData();
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return NextResponse.redirect(new URL('/dashboard/buddies?error=group-invalid', request.url));
  return NextResponse.redirect(new URL('/dashboard/buddies?group=created', request.url));
}
