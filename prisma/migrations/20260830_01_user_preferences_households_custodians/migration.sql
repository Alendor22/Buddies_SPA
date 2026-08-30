CREATE TYPE "DogCustodianRole" AS ENUM ('OWNER', 'CAREGIVER', 'WALKER', 'VIEWER');

CREATE TABLE "UserPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "theme" TEXT NOT NULL DEFAULT 'system',
  "locale" TEXT NOT NULL DEFAULT 'en',
  "marketingEmails" BOOLEAN NOT NULL DEFAULT false,
  "safetyAlerts" BOOLEAN NOT NULL DEFAULT true,
  "marketplaceMessages" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Household" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Household_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HouseholdMember" (
  "id" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HouseholdMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DogCustodian" (
  "id" TEXT NOT NULL,
  "dogId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "DogCustodianRole" NOT NULL DEFAULT 'VIEWER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DogCustodian_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");
CREATE UNIQUE INDEX "HouseholdMember_householdId_userId_key" ON "HouseholdMember"("householdId", "userId");
CREATE INDEX "HouseholdMember_userId_idx" ON "HouseholdMember"("userId");
CREATE UNIQUE INDEX "DogCustodian_dogId_userId_key" ON "DogCustodian"("dogId", "userId");
CREATE INDEX "DogCustodian_userId_role_idx" ON "DogCustodian"("userId", "role");
CREATE INDEX "DogCustodian_dogId_role_idx" ON "DogCustodian"("dogId", "role");

ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HouseholdMember" ADD CONSTRAINT "HouseholdMember_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HouseholdMember" ADD CONSTRAINT "HouseholdMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DogCustodian" ADD CONSTRAINT "DogCustodian_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DogCustodian" ADD CONSTRAINT "DogCustodian_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve Dog.ownerId as the authoritative owner while introducing multi-custodian access.
-- Backfill is idempotent because (dogId,userId) is unique.
INSERT INTO "DogCustodian" ("id", "dogId", "userId", "role", "createdAt", "updatedAt")
SELECT
  'dc_' || md5(d."id" || ':' || d."ownerId"),
  d."id",
  d."ownerId",
  'OWNER'::"DogCustodianRole",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Dog" d
WHERE d."ownerId" IS NOT NULL
ON CONFLICT ("dogId", "userId") DO NOTHING;
