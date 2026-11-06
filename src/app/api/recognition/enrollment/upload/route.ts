import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { isDogRecognitionEnrollmentEnabled } from '@/lib/recognition/featureFlag';
import { recognitionRepository } from '@/lib/recognition/repository';
import {
  createRecognitionEnrollmentUpload,
  RecognitionStorageConfigurationError,
  RecognitionStorageValidationError
} from '@/lib/recognition/storage';

const uploadSchema = z.object({
  dogId: z.string().trim().min(1),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  contentLength: z.number().int().positive(),
  captureView: z.enum(['FRONT_LEFT','FRONT_CENTER','FRONT_RIGHT','REAR_LEFT','REAR_CENTER','REAR_RIGHT','LEFT_HEAD_ON','RIGHT_HEAD_ON'])
});

export async function POST(request: NextRequest) {
  if (!isDogRecognitionEnrollmentEnabled()) {
    return NextResponse.json({ error: 'Dog recognition enrollment is not enabled.' }, { status: 404 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const parsed = uploadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Valid dogId, mimeType, and contentLength are required.' }, { status: 400 });

  const enrollment = await recognitionRepository.findEnrollmentByDogId(parsed.data.dogId);
  if (!enrollment || enrollment.ownerId !== user.id || enrollment.status === 'REVOKED' || enrollment.status === 'PAUSED') {
    return NextResponse.json({ error: 'Active recognition enrollment not found.' }, { status: 404 });
  }

  try {
    const upload = await createRecognitionEnrollmentUpload({ ...parsed.data, ownerId: user.id });
    return NextResponse.json({ upload });
  } catch (error) {
    if (error instanceof RecognitionStorageValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof RecognitionStorageConfigurationError) {
      return NextResponse.json({ error: 'Recognition asset storage is unavailable.' }, { status: 503 });
    }
    throw error;
  }
}
