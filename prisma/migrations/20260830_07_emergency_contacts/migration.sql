CREATE TABLE "DogEmergencyContact" (
  "id" TEXT NOT NULL,
  "dogId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "relation" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DogEmergencyContact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DogEmergencyContact_dogId_priority_idx" ON "DogEmergencyContact"("dogId", "priority");

ALTER TABLE "DogEmergencyContact"
ADD CONSTRAINT "DogEmergencyContact_dogId_fkey"
FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve the legacy free-form contact string as the first contact record.
INSERT INTO "DogEmergencyContact" ("id", "dogId", "name", "phone", "relation", "priority", "createdAt", "updatedAt")
SELECT
  'dec_' || md5(d."id" || ':legacy'),
  d."id",
  'Legacy emergency contact',
  d."emergencyContact",
  'legacy',
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Dog" d
WHERE d."emergencyContact" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "DogEmergencyContact" c
    WHERE c."dogId" = d."id" AND c."relation" = 'legacy'
  );
