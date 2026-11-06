import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isDogRecognitionEnrollmentEnabled } from '@/lib/recognition/featureFlag';
import { listMatchMessages, sendMatchMessage } from '@/lib/recognition/matches';
import { RecognitionAuthorizationError, RecognitionStateError } from '@/lib/recognition/service';

function mapError(error: unknown) {
  if (error instanceof RecognitionAuthorizationError) return NextResponse.json({ error: error.message }, { status: 403 });
  if (error instanceof RecognitionStateError) return NextResponse.json({ error: error.message }, { status: 409 });
  throw error;
}

export async function GET(_request: NextRequest, context: { params: Promise<{ requestId: string; dogId: string }> }) {
  if (!isDogRecognitionEnrollmentEnabled()) return NextResponse.json({ error: 'Dog recognition is disabled.' }, { status: 404 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const { requestId, dogId } = await context.params;
  try {
    const { messages } = await listMatchMessages({ requestId, dogId, userId: user.id });
    return NextResponse.json({ messages });
  } catch (error) {
    return mapError(error);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ requestId: string; dogId: string }> }) {
  if (!isDogRecognitionEnrollmentEnabled()) return NextResponse.json({ error: 'Dog recognition is disabled.' }, { status: 404 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const { requestId, dogId } = await context.params;
  const payload = await request.json().catch(() => null) as { body?: unknown } | null;
  const body = typeof payload?.body === 'string' ? payload.body : '';

  try {
    const { message, recipientId, dogName } = await sendMatchMessage({ requestId, dogId, userId: user.id, body });

    await prisma.notification.create({
      data: {
        userId: recipientId,
        type: 'SYSTEM',
        routeKey: `lost-dog-recognition-message:${requestId}:${dogId}`,
        href: `/dashboard/lost-dog-matches/${encodeURIComponent(requestId)}/${encodeURIComponent(dogId)}`,
        title: `New message about ${dogName}`,
        body: body.length > 160 ? `${body.slice(0, 157)}…` : body,
        dogId
      }
    }).catch(() => undefined);

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return mapError(error);
  }
}
