import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { reportContent } from '@/lib/social/repository';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const payload = await request.json().catch(() => null) as {
    targetType?: unknown; targetId?: unknown; targetUserId?: unknown; targetDogId?: unknown; category?: unknown; details?: unknown;
  } | null;
  const targetType = typeof payload?.targetType === 'string' ? payload.targetType.trim().slice(0, 40) : '';
  const targetId = typeof payload?.targetId === 'string' ? payload.targetId.trim() || null : null;
  const targetUserId = typeof payload?.targetUserId === 'string' ? payload.targetUserId.trim() || null : null;
  const targetDogId = typeof payload?.targetDogId === 'string' ? payload.targetDogId.trim() || null : null;
  const category = typeof payload?.category === 'string' ? payload.category.trim().slice(0, 80) : '';
  const details = typeof payload?.details === 'string' ? payload.details.trim().slice(0, 2000) || null : null;
  if (!targetType || !category) return NextResponse.json({ error: 'Target type and category are required.' }, { status: 400 });
  const reportId = await reportContent(user.id, targetType, targetId, category, details, targetUserId, targetDogId);
  return NextResponse.json({ reportId }, { status: 201 });
}
