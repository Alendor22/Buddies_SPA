CREATE TABLE "DogShareGrant" (
  "id" TEXT NOT NULL,
  "dogId" TEXT NOT NULL,
  "grantedById" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DogShareGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DogShareGrant_tokenHash_key" ON "DogShareGrant"("tokenHash");
CREATE INDEX "DogShareGrant_dogId_expiresAt_idx" ON "DogShareGrant"("dogId", "expiresAt");
CREATE INDEX "DogShareGrant_grantedById_createdAt_idx" ON "DogShareGrant"("grantedById", "createdAt");

ALTER TABLE "DogShareGrant"
ADD CONSTRAINT "DogShareGrant_dogId_fkey"
FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DogShareGrant"
ADD CONSTRAINT "DogShareGrant_grantedById_fkey"
FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
