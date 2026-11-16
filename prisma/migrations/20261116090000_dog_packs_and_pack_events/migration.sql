-- Dog-centered packs and optional pack-linked meetups. Existing social groups
-- remain user-centered and are not reinterpreted as packs.
CREATE TYPE "DogPackMemberStatus" AS ENUM ('INVITED', 'REQUESTED', 'ACCEPTED', 'DECLINED', 'LEFT');

CREATE TABLE "DogPack" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "city" TEXT,
  "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DogPack_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DogPack_ownerId_createdAt_idx" ON "DogPack"("ownerId", "createdAt");
CREATE INDEX "DogPack_city_visibility_idx" ON "DogPack"("city", "visibility");

CREATE TABLE "DogPackMember" (
  "id" TEXT NOT NULL,
  "packId" TEXT NOT NULL,
  "dogId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "DogPackMemberStatus" NOT NULL DEFAULT 'INVITED',
  "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  CONSTRAINT "DogPackMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DogPackMember_packId_dogId_key" ON "DogPackMember"("packId", "dogId");
CREATE INDEX "DogPackMember_userId_status_invitedAt_idx" ON "DogPackMember"("userId", "status", "invitedAt");
CREATE INDEX "DogPackMember_dogId_status_idx" ON "DogPackMember"("dogId", "status");

ALTER TABLE "DogPack" ADD CONSTRAINT "DogPack_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DogPackMember" ADD CONSTRAINT "DogPackMember_packId_fkey" FOREIGN KEY ("packId") REFERENCES "DogPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DogPackMember" ADD CONSTRAINT "DogPackMember_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DogPackMember" ADD CONSTRAINT "DogPackMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SocialEvent" ADD COLUMN "packId" TEXT;
CREATE INDEX "SocialEvent_packId_startsAt_idx" ON "SocialEvent"("packId", "startsAt");
ALTER TABLE "SocialEvent" ADD CONSTRAINT "SocialEvent_packId_fkey" FOREIGN KEY ("packId") REFERENCES "DogPack"("id") ON DELETE SET NULL ON UPDATE CASCADE;
