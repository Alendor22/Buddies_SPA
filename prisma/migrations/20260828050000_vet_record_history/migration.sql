-- Record the existing veterinary-record model in migration history. Existing
-- installations may already have this table from an earlier schema push.
CREATE TABLE IF NOT EXISTS "VetRecord" (
  "id" TEXT NOT NULL,
  "dogId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "recordType" TEXT,
  "notes" TEXT,
  "documentUrl" TEXT,
  "dueAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VetRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VetRecord_dogId_dueAt_idx" ON "VetRecord"("dogId", "dueAt");
CREATE INDEX IF NOT EXISTS "VetRecord_ownerId_idx" ON "VetRecord"("ownerId");

DO $$ BEGIN
  ALTER TABLE "VetRecord" ADD CONSTRAINT "VetRecord_dogId_fkey"
    FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "VetRecord" ADD CONSTRAINT "VetRecord_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
