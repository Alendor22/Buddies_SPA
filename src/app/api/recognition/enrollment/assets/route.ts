import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { isDogRecognitionEnrollmentEnabled } from '@/lib/recognition/featureFlag';
import {
  addRecognitionEnrollmentAsset,
  processRecognitionEnrollmentAsset,
  RecognitionAuthorizationError,
  RecognitionStateError
} from '@/lib/recognition/service';

const assetSchema = z.object({
  dogId: z.string().trim().min(1),
  storageKey: z.string().trim().min(1),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/i),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  captureView: z.enum(['FRONT_LEFT','FRONT_CENTER','FRONT_RIGHT','REAR_LEFT','REAR_CENTER','REAR_RIGHT','LEFT_HEAD_ON','RIGHT_HEAD_ON']),
  capturedAt: z.string().datetime().optional()
});

const processSchema = z.object({ assetId: z.string().trim().min(1) });

function disabled() {
  return NextResponse.json({ error: 'Dog recognition enrollment is not enabled.' }, { status: 404 });
}

function mapError(error: unknown) {
  if (error instanceof RecognitionAuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof RecognitionStateError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  throw error;
}

export async function POST(request: NextRequest) {
  if (!isDogRecognitionEnrollmentEnabled()) return disabled();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const parsed = assetSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid enrollment asset payload.' }, { status: 400 });

  const expectedPrefix = `recognition/enrollment/${user.id}/${parsed.data.dogId}/`;
  if (!parsed.data.storageKey.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: 'Enrollment storage key is outside the authorized dog prefix.' }, { status: 403 });
  }

  try {
    const asset = await addRecognitionEnrollmentAsset({
      ...parsed.data,
      ownerId: user.id,
      capturedAt: parsed.data.capturedAt ? new Date(parsed.data.capturedAt) : undefined
    });
    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    return mapError(error);
  }
}

export async function PATCH(request: NextRequest) {
  if (!isDogRecognitionEnrollmentEnabled()) return disabled();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const parsed = processSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'assetId is required.' }, { status: 400 });

  try {
    const asset = await processRecognitionEnrollmentAsset({ assetId: parsed.data.assetId, ownerId: user.id });
    return NextResponse.json({ asset });
  } catch (error) {
    return mapError(error);
  }
}
