import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { isDogRecognitionEnrollmentEnabled } from '@/lib/recognition/featureFlag';
import { DOG_REID_MODEL_VERSION } from '@/lib/recognition/embeddings';
import { activateRecognitionEnrollment, RecognitionAuthorizationError, RecognitionStateError } from '@/lib/recognition/service';

const schema = z.object({ dogId: z.string().trim().min(1) });

export async function POST(request: NextRequest) {
  if (!isDogRecognitionEnrollmentEnabled()) return NextResponse.json({ error: 'Dog recognition enrollment is disabled.' }, { status: 404 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'dogId is required.' }, { status: 400 });

  try {
    const enrollment = await activateRecognitionEnrollment({
      dogId: parsed.data.dogId,
      ownerId: user.id,
      modelVersion: DOG_REID_MODEL_VERSION
    });
    return NextResponse.json({ enrollment });
  } catch (error) {
    if (error instanceof RecognitionAuthorizationError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof RecognitionStateError) return NextResponse.json({ error: error.message }, { status: 409 });
    throw error;
  }
}
