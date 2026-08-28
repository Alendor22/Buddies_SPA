-- Align the initial migration history with the user and dog profile fields that
-- were introduced before the notification backfills began depending on them.
-- IF NOT EXISTS keeps this safe for databases that already received these
-- columns through an earlier schema push.
DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('OWNER', 'WALKER', 'ADMIN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'OWNER';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;

ALTER TABLE "Dog" ADD COLUMN IF NOT EXISTS "publicId" TEXT;
ALTER TABLE "Dog" ADD COLUMN IF NOT EXISTS "weightLbs" INTEGER;
ALTER TABLE "Dog" ADD COLUMN IF NOT EXISTS "gender" TEXT;
ALTER TABLE "Dog" ADD COLUMN IF NOT EXISTS "temperament" TEXT;
ALTER TABLE "Dog" ADD COLUMN IF NOT EXISTS "vaccinationNotes" TEXT;
ALTER TABLE "Dog" ADD COLUMN IF NOT EXISTS "lostSince" TIMESTAMP(3);
ALTER TABLE "Dog" ADD COLUMN IF NOT EXISTS "lastSeenLocation" TEXT;
ALTER TABLE "Dog" ADD COLUMN IF NOT EXISTS "lostReward" TEXT;
ALTER TABLE "Dog" ADD COLUMN IF NOT EXISTS "lostNotes" TEXT;
ALTER TABLE "Dog" ADD COLUMN IF NOT EXISTS "spayedNeutered" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Dog" ADD COLUMN IF NOT EXISTS "friendlyDogs" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Dog" ADD COLUMN IF NOT EXISTS "friendlyCats" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Dog" ADD COLUMN IF NOT EXISTS "friendlyChildren" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "Dog_publicId_idx" ON "Dog"("publicId");
