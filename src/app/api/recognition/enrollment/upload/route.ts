import { PutObjectCommand } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { isDogRecognitionEnrollmentEnabled } from '@/lib/recognition/featureFlag';
import { recognitionRepository } from '@/lib/recognition/repository';
import { r2 } from '@/lib/r2';
import {
  createRecognitionEnrollmentUpload,
  RecognitionStorageConfigurationError,
  RecognitionStorageValidationError,
  validateRecognitionUpload
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

// Same-origin fallback for browsers that block direct presigned R2 PUTs.
// The client still uses the presigned path first; this path keeps enrollment
// functional when bucket CORS is missing or stale on mobile Safari.
export async function PUT(request: NextRequest) {
  if (!isDogRecognitionEnrollmentEnabled()) {
    return NextResponse.json({ error: 'Dog recognition enrollment is not enabled.' }, { status: 404 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const dogId = String(form?.get('dogId') ?? '').trim();
  const storageKey = String(form?.get('storageKey') ?? '').trim();
  const image = form?.get('image');
  if (!dogId || !storageKey || !(image instanceof File)) {
    return NextResponse.json({ error: 'dogId, storageKey, and image are required.' }, { status: 400 });
  }

  const expectedPrefix = `recognition/enrollment/${user.id}/${dogId}/`;
  if (!storageKey.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: 'Enrollment storage key is outside the authorized dog prefix.' }, { status: 403 });
  }

  const enrollment = await recognitionRepository.findEnrollmentByDogId(dogId);
  if (!enrollment || enrollment.ownerId !== user.id || enrollment.status === 'REVOKED' || enrollment.status === 'PAUSED') {
    return NextResponse.json({ error: 'Active recognition enrollment not found.' }, { status: 404 });
  }

  try {
    validateRecognitionUpload({ mimeType: image.type, contentLength: image.size });
    const bucket = process.env.R2_BUCKET_NAME;
    if (!bucket) throw new RecognitionStorageConfigurationError('R2_BUCKET_NAME is not configured');
    await r2.send(new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      Body: new Uint8Array(await image.arrayBuffer()),
      ContentType: image.type
    }));
    return NextResponse.json({ uploaded: true });
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
