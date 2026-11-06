import { GetObjectCommand } from '@aws-sdk/client-s3';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { r2 } from '@/lib/r2';
import { isDogRecognitionEnrollmentEnabled } from '@/lib/recognition/featureFlag';
import { getMatchPhoto } from '@/lib/recognition/matches';
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
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) return NextResponse.json({ error: 'Photo storage is unavailable.' }, { status: 503 });

  try {
    const photo = await getMatchPhoto({ requestId, dogId, userId: user.id });
    const object = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: photo.storageKey }));
    if (!object.Body) return NextResponse.json({ error: 'Photo is unavailable.' }, { status: 404 });
    const bytes = await object.Body.transformToByteArray();
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type': photo.mimeType,
        'Cache-Control': 'private, no-store'
      }
    });
  } catch (error) {
    return mapError(error);
  }
}
