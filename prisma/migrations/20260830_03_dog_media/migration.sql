CREATE TABLE "DogMedia" (
  "id" TEXT NOT NULL,
  "dogId" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'PHOTO',
  "url" TEXT NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DogMedia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DogMedia_dogId_isPrimary_idx" ON "DogMedia"("dogId", "isPrimary");
CREATE INDEX "DogMedia_dogId_createdAt_idx" ON "DogMedia"("dogId", "createdAt");

ALTER TABLE "DogMedia"
ADD CONSTRAINT "DogMedia_dogId_fkey"
FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Compatibility backfill. Dog.photoUrl remains in place until a later production cutover.
INSERT INTO "DogMedia" ("id", "dogId", "kind", "url", "isPrimary", "createdAt")
SELECT
  'dm_' || md5(d."id" || ':primary'),
  d."id",
  'PHOTO',
  d."photoUrl",
  true,
  CURRENT_TIMESTAMP
FROM "Dog" d
WHERE d."photoUrl" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "DogMedia" m
    WHERE m."dogId" = d."id" AND m."url" = d."photoUrl"
  );
