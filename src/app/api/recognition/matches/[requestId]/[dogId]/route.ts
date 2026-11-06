import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isDogRecognitionEnrollmentEnabled } from '@/lib/recognition/featureFlag';
import { getMatchForViewer } from '@/lib/recognition/matches';
import { RecognitionAuthorizationError, RecognitionStateError } from '@/lib/recognition/service';

function mapError(error: unknown) {
  if (error instanceof RecognitionAuthorizationError) return NextResponse.json({ error: error.message }, { status: 403 });
  if (error instanceof RecognitionStateError) return NextResponse.json({ error: error.message }, { status: 404 });
  throw error;
}

export async function GET(_request: Request, context: { params: Promise<{ requestId: string; dogId: string }> }) {
  if (!isDogRecognitionEnrollmentEnabled()) return NextResponse.json({ error: 'Dog recognition is disabled.' }, { status: 404 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const { requestId, dogId } = await context.params;
  try {
    const match = await getMatchForViewer({ requestId, dogId, userId: user.id });
    return NextResponse.json({ match });
  } catch (error) {
    return mapError(error);
  }
}
