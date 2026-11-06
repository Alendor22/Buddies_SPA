import { prisma } from '@/lib/db';
import type { RecognitionCaptureView, RecognitionEventOutcome } from '@/generated/prisma/client';

export type CreateEnrollmentRecord = {
  dogId: string;
  ownerId: string;
  consentVersion: string;
  consentedAt: Date;
};

export type AddEnrollmentAssetRecord = {
  enrollmentId: string;
  storageKey: string;
  contentHash: string;
  mimeType: string;
  captureView: RecognitionCaptureView;
  capturedAt?: Date;
};

export type RecordRecognitionEvent = {
  requestId: string;
  source: string;
  imageRef?: string;
  matchedDogId?: string;
  confidence?: number;
  outcome: RecognitionEventOutcome;
  modelVersion: string;
  candidateCount: number;
  latencyMs?: number;
  metadata?: Record<string, unknown>;
};

export const recognitionRepository = {
  findEnrollmentByDogId(dogId: string) {
    return prisma.recognitionEnrollment.findUnique({
      where: { dogId },
      include: { assets: { orderBy: { createdAt: 'desc' } } }
    });
  },

  createEnrollment(input: CreateEnrollmentRecord) {
    return prisma.recognitionEnrollment.create({ data: input });
  },

  reactivateEnrollment(id: string, ownerId: string, consentVersion: string, consentedAt: Date) {
    return prisma.recognitionEnrollment.update({
      where: { id },
      data: {
        ownerId,
        consentVersion,
        consentedAt,
        status: 'PENDING',
        revokedAt: null,
        activatedAt: null,
        modelVersion: null
      }
    });
  },

  addAsset(input: AddEnrollmentAssetRecord) {
    return prisma.recognitionAsset.create({ data: input });
  },

  findAssetByContentHash(enrollmentId: string, contentHash: string) {
    return prisma.recognitionAsset.findUnique({
      where: { enrollmentId_contentHash: { enrollmentId, contentHash } }
    });
  },

  findAsset(assetId: string) {
    return prisma.recognitionAsset.findUnique({
      where: { id: assetId },
      include: { enrollment: true }
    });
  },

  markAssetProcessing(assetId: string) {
    return prisma.recognitionAsset.update({
      where: { id: assetId },
      data: { status: 'PROCESSING', rejectionCode: null }
    });
  },

  markAssetReady(assetId: string, modelVersion: string, embeddingRef: string, qualityScore?: number) {
    return prisma.recognitionAsset.update({
      where: { id: assetId },
      data: { status: 'READY', modelVersion, embeddingRef, qualityScore, processedAt: new Date(), rejectionCode: null }
    });
  },

  markAssetRejected(assetId: string, rejectionCode: string) {
    return prisma.recognitionAsset.update({
      where: { id: assetId },
      data: { status: 'REJECTED', rejectionCode, processedAt: new Date() }
    });
  },

  activateEnrollment(id: string, modelVersion: string) {
    return prisma.recognitionEnrollment.update({
      where: { id },
      data: { status: 'ACTIVE', modelVersion, activatedAt: new Date(), revokedAt: null }
    });
  },

  // Atomically gate the enrollment against new asset mutations before a revocation
  // purge starts. PAUSED here means "revocation in progress", not a user-facing pause
  // feature. Re-running this against an enrollment already PAUSED is a no-op match,
  // so a retried revoke after a partial purge failure can resume.
  beginRevocation(id: string) {
    return prisma.recognitionEnrollment.updateMany({
      where: { id, status: { in: ['ACTIVE', 'PENDING', 'PAUSED'] } },
      data: { status: 'PAUSED' }
    });
  },

  revokeEnrollment(id: string) {
    return prisma.recognitionEnrollment.update({
      where: { id },
      data: { status: 'REVOKED', revokedAt: new Date(), activatedAt: null }
    });
  },

  recordEvent(input: RecordRecognitionEvent) {
    return prisma.recognitionEvent.create({
      data: {
        ...input,
        metadata: input.metadata as never
      }
    });
  }
};
