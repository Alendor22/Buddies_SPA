import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { isDogRecognitionEnrollmentEnabled } from '@/lib/recognition/featureFlag';
import { recognitionRepository } from '@/lib/recognition/repository';
import {
  beginRecognitionEnrollment,
  RecognitionAuthorizationError,
  RecognitionStateError,
  revokeRecognitionEnrollment
} from '@/lib/recognition/service';

export const dynamic = 'force-dynamic';

const beginSchema = z.object({
  dogId: z.string().trim().min(1),
  consentAccepted: z.literal(true)
});

const revokeSchema = z.object({ dogId: z.string().trim().min(1) });

function disabled() {
  return NextResponse.json({ error: 'Dog recognition enrollment is not enabled.' }, { status: 404 });
}

function enrollmentError(error: unknown) {
  if (error instanceof RecognitionAuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof RecognitionStateError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  throw error;
}

export async function GET(request: NextRequest) {
  if (!isDogRecognitionEnrollmentEnabled()) return disabled();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const dogId = request.nextUrl.searchParams.get('dogId')?.trim();
  if (!dogId) return NextResponse.json({ error: 'dogId is required.' }, { status: 400 });

  const enrollment = await recognitionRepository.findEnrollmentByDogId(dogId);
  if (!enrollment || enrollment.ownerId !== user.id) {
    return NextResponse.json({ error: 'Recognition enrollment not found.' }, { status: 404 });
  }

  return NextResponse.json({ enrollment });
}

export async function POST(request: NextRequest) {
  if (!isDogRecognitionEnrollmentEnabled()) return disabled();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const parsed = beginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'dogId and explicit recognition consent are required.' }, { status: 400 });
  }

  try {
    const enrollment = await beginRecognitionEnrollment({
      dogId: parsed.data.dogId,
      ownerId: user.id,
      consentAccepted: parsed.data.consentAccepted
    });
    return NextResponse.json({ enrollment }, { status: 201 });
  } catch (error) {
    return enrollmentError(error);
  }
}

export async function DELETE(request: NextRequest) {
  if (!isDogRecognitionEnrollmentEnabled()) return disabled();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const parsed = revokeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'dogId is required.' }, { status: 400 });

  try {
    const enrollment = await revokeRecognitionEnrollment(parsed.data.dogId, user.id);
    return NextResponse.json({ enrollment });
  } catch (error) {
    return enrollmentError(error);
  }
}
