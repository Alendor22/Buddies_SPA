CREATE TYPE "RecognitionEnrollmentStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'REVOKED');
CREATE TYPE "RecognitionAssetStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'REJECTED', 'DELETED');
CREATE TYPE "RecognitionEventOutcome" AS ENUM ('MATCH', 'LOW_CONFIDENCE', 'NO_MATCH', 'ERROR');

CREATE TABLE "RecognitionEnrollment" (
  "id" TEXT NOT NULL,
  "dogId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "status" "RecognitionEnrollmentStatus" NOT NULL DEFAULT 'PENDING',
  "modelVersion" TEXT,
  "consentVersion" TEXT NOT NULL,
  "consentedAt" TIMESTAMP(3) NOT NULL,
  "activatedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecognitionEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecognitionAsset" (
  "id" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "status" "RecognitionAssetStatus" NOT NULL DEFAULT 'PENDING',
  "modelVersion" TEXT,
  "embeddingRef" TEXT,
  "qualityScore" DOUBLE PRECISION,
  "rejectionCode" TEXT,
  "capturedAt" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecognitionAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecognitionEvent" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "imageRef" TEXT,
  "matchedDogId" TEXT,
  "confidence" DOUBLE PRECISION,
  "outcome" "RecognitionEventOutcome" NOT NULL,
  "modelVersion" TEXT NOT NULL,
  "candidateCount" INTEGER NOT NULL DEFAULT 0,
  "latencyMs" INTEGER,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecognitionEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecognitionEnrollment_dogId_key" ON "RecognitionEnrollment"("dogId");
CREATE INDEX "RecognitionEnrollment_ownerId_status_idx" ON "RecognitionEnrollment"("ownerId", "status");
CREATE INDEX "RecognitionEnrollment_status_updatedAt_idx" ON "RecognitionEnrollment"("status", "updatedAt");
CREATE UNIQUE INDEX "RecognitionAsset_enrollmentId_contentHash_key" ON "RecognitionAsset"("enrollmentId", "contentHash");
CREATE INDEX "RecognitionAsset_enrollmentId_status_idx" ON "RecognitionAsset"("enrollmentId", "status");
CREATE INDEX "RecognitionAsset_status_createdAt_idx" ON "RecognitionAsset"("status", "createdAt");
CREATE UNIQUE INDEX "RecognitionEvent_requestId_key" ON "RecognitionEvent"("requestId");
CREATE INDEX "RecognitionEvent_matchedDogId_createdAt_idx" ON "RecognitionEvent"("matchedDogId", "createdAt");
CREATE INDEX "RecognitionEvent_outcome_createdAt_idx" ON "RecognitionEvent"("outcome", "createdAt");
CREATE INDEX "RecognitionEvent_modelVersion_createdAt_idx" ON "RecognitionEvent"("modelVersion", "createdAt");

ALTER TABLE "RecognitionEnrollment" ADD CONSTRAINT "RecognitionEnrollment_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecognitionEnrollment" ADD CONSTRAINT "RecognitionEnrollment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecognitionAsset" ADD CONSTRAINT "RecognitionAsset_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "RecognitionEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecognitionEvent" ADD CONSTRAINT "RecognitionEvent_matchedDogId_fkey" FOREIGN KEY ("matchedDogId") REFERENCES "Dog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
