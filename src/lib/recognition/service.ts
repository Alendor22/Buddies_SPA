import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { r2 } from '@/lib/r2';
import { getRecognitionAssetProcessor } from './processor';
import { recognitionRepository } from './repository';

const CONSENT_VERSION = 'dog-recognition-v1';

export class RecognitionAuthorizationError extends Error {
  constructor(message = 'You are not authorized to manage recognition for this dog') {
    super(message);
    this.name = 'RecognitionAuthorizationError';
  }
}

export class RecognitionStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecognitionStateError';
  }
}

async function requireOwnedDog(dogId: string, ownerId: string) {
  const dog = await prisma.dog.findFirst({
    where: { id: dogId, ownerId },
    select: { id: true, ownerId: true, slug: true, name: true }
  });
  if (!dog) throw new RecognitionAuthorizationError();
  return dog;
}

export async function beginRecognitionEnrollment(input: {
  dogId: string;
  ownerId: string;
  consentAccepted: boolean;
}) {
  await requireOwnedDog(input.dogId, input.ownerId);
  if (!input.consentAccepted) throw new RecognitionStateError('Recognition enrollment requires explicit consent');

  const existing = await recognitionRepository.findEnrollmentByDogId(input.dogId);
  const consentedAt = new Date();

  if (!existing) {
    return recognitionRepository.createEnrollment({
      dogId: input.dogId,
      ownerId: input.ownerId,
      consentVersion: CONSENT_VERSION,
      consentedAt
    });
  }

  if (existing.ownerId !== input.ownerId) throw new RecognitionAuthorizationError();
  if (existing.status === 'ACTIVE' || existing.status === 'PENDING') return existing;
  if (existing.status === 'PAUSED') {
    throw new RecognitionStateError('Recognition enrollment revocation is still in progress; try again shortly');
  }

  return recognitionRepository.reactivateEnrollment(
    existing.id,
    input.ownerId,
    CONSENT_VERSION,
    consentedAt
  );
}

export async function addRecognitionEnrollmentAsset(input: {
  dogId: string;
  ownerId: string;
  storageKey: string;
  contentHash: string;
  mimeType: string;
  captureView: import('@/generated/prisma/client').RecognitionCaptureView;
  capturedAt?: Date;
}) {
  await requireOwnedDog(input.dogId, input.ownerId);
  const enrollment = await recognitionRepository.findEnrollmentByDogId(input.dogId);
  if (!enrollment || enrollment.ownerId !== input.ownerId) {
    throw new RecognitionStateError('Begin recognition enrollment before adding assets');
  }
  if (enrollment.status === 'REVOKED' || enrollment.status === 'PAUSED') {
    throw new RecognitionStateError('Recognition enrollment is revoked');
  }

  try {
    return await recognitionRepository.addAsset({
      enrollmentId: enrollment.id,
      storageKey: input.storageKey,
      contentHash: input.contentHash,
      mimeType: input.mimeType,
      captureView: input.captureView,
      capturedAt: input.capturedAt
    });
  } catch (error) {
    // A retried upload for a view that already succeeded re-sends the identical file
    // (same content hash). Treat that as idempotent rather than surfacing a raw 500.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await recognitionRepository.findAssetByContentHash(enrollment.id, input.contentHash);
      if (existing) {
        // The caller already uploaded input.storageKey to R2 before this call. Since
        // we're keeping the earlier-tracked asset instead, delete the just-uploaded
        // duplicate now rather than leaving an untracked copy that revocation's purge
        // would never find.
        const bucket = process.env.R2_BUCKET_NAME;
        if (bucket && input.storageKey !== existing.storageKey) {
          await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: input.storageKey })).catch(() => undefined);
        }
        return existing;
      }
    }
    throw error;
  }
}

export async function processRecognitionEnrollmentAsset(input: {
  assetId: string;
  ownerId: string;
}) {
  const asset = await recognitionRepository.findAsset(input.assetId);
  if (!asset || asset.enrollment.ownerId !== input.ownerId) throw new RecognitionAuthorizationError();
  if (asset.enrollment.status === 'REVOKED' || asset.enrollment.status === 'PAUSED') {
    throw new RecognitionStateError('Recognition enrollment is revoked');
  }
  if (asset.status === 'READY') return asset;

  await recognitionRepository.markAssetProcessing(asset.id);
  try {
    const result = await getRecognitionAssetProcessor().process({
      assetId: asset.id,
      enrollmentId: asset.enrollmentId,
      dogId: asset.enrollment.dogId,
      storageKey: asset.storageKey,
      mimeType: asset.mimeType
    });
    return recognitionRepository.markAssetReady(
      asset.id,
      result.modelVersion,
      result.embeddingRef,
      result.qualityScore
    );
  } catch (error) {
    await recognitionRepository.markAssetRejected(asset.id, 'PROCESSOR_ERROR');
    throw error;
  }
}

export async function activateRecognitionEnrollment(input: {
  dogId: string;
  ownerId: string;
  modelVersion: string;
}) {
  await requireOwnedDog(input.dogId, input.ownerId);
  const enrollment = await recognitionRepository.findEnrollmentByDogId(input.dogId);
  if (!enrollment || enrollment.ownerId !== input.ownerId) throw new RecognitionStateError('Recognition enrollment does not exist');
  if (enrollment.status === 'REVOKED' || enrollment.status === 'PAUSED') {
    throw new RecognitionStateError('Recognition enrollment is revoked; accept consent again before activation');
  }

  const readyForModel = enrollment.assets.filter(
    (asset) => asset.status === 'READY' && asset.modelVersion === input.modelVersion
  );
  const readyViews = new Set(readyForModel.map((asset) => asset.captureView).filter(Boolean));
  if (readyViews.size !== 8) {
    throw new RecognitionStateError('All eight photo angles must be processed before activation');
  }

  return recognitionRepository.activateEnrollment(enrollment.id, input.modelVersion);
}

export async function revokeRecognitionEnrollment(dogId: string, ownerId: string) {
  await requireOwnedDog(dogId, ownerId);
  const enrollment = await recognitionRepository.findEnrollmentByDogId(dogId);
  if (!enrollment || enrollment.ownerId !== ownerId) throw new RecognitionStateError('Recognition enrollment does not exist');
  if (enrollment.status === 'REVOKED') return enrollment;

  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new RecognitionStateError('Recognition storage is unavailable for deletion');

  // Gate new asset mutations before touching R2: without this, a request racing the
  // purge below could add or process an asset that misses this snapshot entirely,
  // leaving it un-purged under a REVOKED enrollment. PAUSED->PAUSED is a no-op match,
  // so retrying after a partial purge failure resumes rather than re-locking.
  const locked = await recognitionRepository.beginRevocation(enrollment.id);
  if (locked.count === 0) {
    const current = await recognitionRepository.findEnrollmentByDogId(dogId);
    if (current?.status === 'REVOKED') return current;
    throw new RecognitionStateError('Recognition enrollment could not be locked for revocation');
  }

  // Re-fetch assets now that mutations are gated, so the purge covers anything added
  // in the window between the initial read above and the lock taking effect.
  const gated = await recognitionRepository.findEnrollmentByDogId(dogId);
  const assets = gated?.assets ?? [];

  // Purge reference photos before flipping the enrollment to REVOKED, so a failed
  // deletion leaves the enrollment locked (PAUSED) and retryable rather than claiming
  // data was purged when it wasn't.
  await Promise.all(assets.map(async (asset) => {
    await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: asset.storageKey }));
    await prisma.recognitionAsset.update({
      where: { id: asset.id },
      data: { status: 'DELETED', embeddingRef: null, qualityScore: null, rejectionCode: null }
    });
  }));
  await recognitionRepository.revokeEnrollment(enrollment.id);
  return recognitionRepository.findEnrollmentByDogId(dogId);
}
