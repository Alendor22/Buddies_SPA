CREATE TABLE "DogMedicalProfile" (
  "id" TEXT NOT NULL,
  "dogId" TEXT NOT NULL,
  "allergies" TEXT,
  "medications" TEXT,
  "conditions" TEXT,
  "dietaryRestrictions" TEXT,
  "veterinarianName" TEXT,
  "veterinarianPhone" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DogMedicalProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DogMedicalProfile_dogId_key" ON "DogMedicalProfile"("dogId");

ALTER TABLE "DogMedicalProfile"
ADD CONSTRAINT "DogMedicalProfile_dogId_fkey"
FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve legacy free-form medical notes while structured writes roll out.
INSERT INTO "DogMedicalProfile" ("id", "dogId", "notes", "createdAt", "updatedAt")
SELECT
  'dmp_' || md5(d."id"),
  d."id",
  d."medicalNotes",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Dog" d
WHERE d."medicalNotes" IS NOT NULL
ON CONFLICT ("dogId") DO NOTHING;
