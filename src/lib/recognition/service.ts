import { prisma } from '@/lib/db';
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
  capturedAt?: Date;
}) {
  await requireOwnedDog(input.dogId, input.ownerId);
  const enrollment = await recognitionRepository.findEnrollmentByDogId(input.dogId);
  if (!enrollment || enrollment.ownerId !== input.ownerId) {
    throw new RecognitionStateError('Begin recognition enrollment before adding assets');
  }
  if (enrollment.status === 'REVOKED') throw new RecognitionStateError('Recognition enrollment is revoked');

  return recognitionRepository.addAsset({
    enrollmentId: enrollment.id,
    storageKey: input.storageKey,
    contentHash: input.contentHash,
    mimeType: input.mimeType,
    capturedAt: input.capturedAt
  });
}

export async function processRecognitionEnrollmentAsset(input: {
  assetId: string;
  ownerId: string;
}) {
  const asset = await recognitionRepository.findAsset(input.assetId);
  if (!asset || asset.enrollment.ownerId !== input.ownerId) throw new RecognitionAuthorizationError();
  if (asset.enrollment.status === 'REVOKED') throw new RecognitionStateError('Recognition enrollment is revoked');
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
  if (enrollment.status === 'REVOKED') {
    throw new RecognitionStateError('Recognition enrollment is revoked; accept consent again before activation');
  }

  const readyForModel = enrollment.assets.filter(
    (asset) => asset.status === 'READY' && asset.modelVersion === input.modelVersion
  );
  if (readyForModel.length < 1) {
    throw new RecognitionStateError('At least one processed enrollment asset for this model version is required');
  }

  return recognitionRepository.activateEnrollment(enrollment.id, input.modelVersion);
}

export async function revokeRecognitionEnrollment(dogId: string, ownerId: string) {
  await requireOwnedDog(dogId, ownerId);
  const enrollment = await recognitionRepository.findEnrollmentByDogId(dogId);
  if (!enrollment || enrollment.ownerId !== ownerId) throw new RecognitionStateError('Recognition enrollment does not exist');
  return recognitionRepository.revokeEnrollment(enrollment.id);
}
