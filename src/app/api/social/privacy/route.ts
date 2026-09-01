import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { blockUser, getSocialPrivacy, upsertSocialPrivacy } from '@/lib/social/repository';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  return NextResponse.json({ privacy: await getSocialPrivacy(user.id) });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const current = await getSocialPrivacy(user.id);
  if (!current) return NextResponse.json({ error: 'Privacy profile unavailable.' }, { status: 404 });
  const payload = await request.json().catch(() => ({})) as Record<string, unknown>;
  const next = {
    discoverable: typeof payload.discoverable === 'boolean' ? payload.discoverable : current.discoverable,
    showCity: typeof payload.showCity === 'boolean' ? payload.showCity : current.showCity,
    allowBuddyRequests: typeof payload.allowBuddyRequests === 'boolean' ? payload.allowBuddyRequests : current.allowBuddyRequests,
    allowWalkInvites: typeof payload.allowWalkInvites === 'boolean' ? payload.allowWalkInvites : current.allowWalkInvites,
    allowMessages: typeof payload.allowMessages === 'boolean' ? payload.allowMessages : current.allowMessages,
    showCheckIns: typeof payload.showCheckIns === 'boolean' ? payload.showCheckIns : current.showCheckIns,
    showActivity: typeof payload.showActivity === 'boolean' ? payload.showActivity : current.showActivity
  };
  return NextResponse.json({ privacy: await upsertSocialPrivacy(user.id, next) });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const payload = await request.json().catch(() => null) as { blockedUserId?: unknown } | null;
  const blockedUserId = typeof payload?.blockedUserId === 'string' ? payload.blockedUserId.trim() : '';
  if (!blockedUserId) return NextResponse.json({ error: 'Blocked user id is required.' }, { status: 400 });
  await blockUser(user.id, blockedUserId);
  return NextResponse.json({ blocked: true }, { status: 201 });
}
