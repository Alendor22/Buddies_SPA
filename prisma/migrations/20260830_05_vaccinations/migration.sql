CREATE TABLE "Vaccination" (
  "id" TEXT NOT NULL,
  "dogId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "administeredAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "documentUrl" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Vaccination_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Vaccination_dogId_expiresAt_idx" ON "Vaccination"("dogId", "expiresAt");
CREATE INDEX "Vaccination_dogId_name_idx" ON "Vaccination"("dogId", "name");

ALTER TABLE "Vaccination"
ADD CONSTRAINT "Vaccination_dogId_fkey"
FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve existing free-form vaccination notes as a legacy-import record.
INSERT INTO "Vaccination" ("id", "dogId", "name", "notes", "createdAt", "updatedAt")
SELECT
  'vac_' || md5(d."id" || ':legacy'),
  d."id",
  'Legacy vaccination record',
  d."vaccinationNotes",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Dog" d
WHERE d."vaccinationNotes" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Vaccination" v
    WHERE v."dogId" = d."id" AND v."name" = 'Legacy vaccination record'
  );
