CREATE TYPE "DogIdentifierType" AS ENUM ('QR', 'MICROCHIP', 'VISUAL_RECOGNITION', 'NFC', 'BLE');

CREATE TABLE "DogIdentifier" (
  "id" TEXT NOT NULL,
  "dogId" TEXT NOT NULL,
  "type" "DogIdentifierType" NOT NULL,
  "hashAlgorithm" TEXT NOT NULL DEFAULT 'sha256',
  "valueHash" TEXT NOT NULL,
  "label" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DogIdentifier_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DogIdentifier_type_hashAlgorithm_valueHash_key"
ON "DogIdentifier"("type", "hashAlgorithm", "valueHash");
CREATE INDEX "DogIdentifier_dogId_type_idx" ON "DogIdentifier"("dogId", "type");

ALTER TABLE "DogIdentifier"
ADD CONSTRAINT "DogIdentifier_dogId_fkey"
FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Legacy publicId is retained. Its initial identifier row records md5 explicitly so
-- future SHA-256 identifiers can coexist without pretending the legacy hash is SHA-256.
INSERT INTO "DogIdentifier" (
  "id", "dogId", "type", "hashAlgorithm", "valueHash", "label", "verifiedAt", "createdAt"
)
SELECT
  'did_' || md5(d."id" || ':publicId'),
  d."id",
  'QR'::"DogIdentifierType",
  'md5',
  md5(d."publicId"),
  'legacy-public-id',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Dog" d
WHERE d."publicId" IS NOT NULL
ON CONFLICT ("type", "hashAlgorithm", "valueHash") DO NOTHING;
