CREATE TYPE "ConsentType" AS ENUM (
  'LOCATION_SHARING',
  'MEDICAL_ACCESS',
  'SCANNER_DISCLOSURE',
  'MARKETPLACE_ACCESS',
  'PHOTO_USAGE',
  'RECOGNITION_ENROLLMENT'
);

CREATE TABLE "ConsentGrant" (
  "id" TEXT NOT NULL,
  "dogId" TEXT NOT NULL,
  "type" "ConsentType" NOT NULL,
  "granted" BOOLEAN NOT NULL,
  "grantedById" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConsentGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "resourceId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConsentGrant_dogId_type_key" ON "ConsentGrant"("dogId", "type");
CREATE INDEX "ConsentGrant_grantedById_createdAt_idx" ON "ConsentGrant"("grantedById", "createdAt");
CREATE INDEX "AuditEvent_resource_resourceId_createdAt_idx" ON "AuditEvent"("resource", "resourceId", "createdAt");
CREATE INDEX "AuditEvent_userId_createdAt_idx" ON "AuditEvent"("userId", "createdAt");

ALTER TABLE "ConsentGrant"
ADD CONSTRAINT "ConsentGrant_dogId_fkey"
FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsentGrant"
ADD CONSTRAINT "ConsentGrant_grantedById_fkey"
FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditEvent"
ADD CONSTRAINT "AuditEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Intentionally no consent backfill. New sensitive capabilities require an explicit grant.
