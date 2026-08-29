import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { r2 } from '@/lib/r2';

const MAX_ENROLLMENT_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export class RecognitionStorageConfigurationError extends Error {}
export class RecognitionStorageValidationError extends Error {}

export function validateRecognitionUpload(input: { mimeType: string; contentLength: number }) {
  if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
    throw new RecognitionStorageValidationError('Enrollment image must be JPEG, PNG, or WebP');
  }
  if (!Number.isInteger(input.contentLength) || input.contentLength < 1 || input.contentLength > MAX_ENROLLMENT_BYTES) {
    throw new RecognitionStorageValidationError(`Enrollment image must be between 1 byte and ${MAX_ENROLLMENT_BYTES} bytes`);
  }
}

export async function createRecognitionEnrollmentUpload(input: {
  dogId: string;
  ownerId: string;
  mimeType: string;
  contentLength: number;
}) {
  validateRecognitionUpload(input);
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new RecognitionStorageConfigurationError('R2_BUCKET_NAME is not configured');

  const extension = input.mimeType === 'image/png' ? 'png' : input.mimeType === 'image/webp' ? 'webp' : 'jpg';
  const storageKey = `recognition/enrollment/${input.ownerId}/${input.dogId}/${randomUUID()}.${extension}`;
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: storageKey,
    ContentType: input.mimeType,
    ContentLength: input.contentLength,
    Metadata: {
      purpose: 'dog-recognition-enrollment',
      dogId: input.dogId,
      ownerId: input.ownerId
    }
  });

  return {
    storageKey,
    uploadUrl: await getSignedUrl(r2, command, { expiresIn: 300 }),
    expiresInSeconds: 300,
    maxBytes: MAX_ENROLLMENT_BYTES
  };
}
