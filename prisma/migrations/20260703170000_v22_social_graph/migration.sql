CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'PAUSED');
CREATE TYPE "PackRole" AS ENUM ('OWNER', 'MODERATOR', 'MEMBER');
CREATE TYPE "PackPostKind" AS ENUM ('UPDATE', 'WALK_REQUEST', 'MEETUP', 'ALERT');

CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "addresseeId" TEXT NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Pack" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "city" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Pack_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PackMembership" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dogId" TEXT,
    "role" "PackRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PackMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PackPost" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "kind" "PackPostKind" NOT NULL DEFAULT 'UPDATE',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "startsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PackPost_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Friendship_requesterId_addresseeId_key" ON "Friendship"("requesterId", "addresseeId");
CREATE INDEX "Friendship_requesterId_status_idx" ON "Friendship"("requesterId", "status");
CREATE INDEX "Friendship_addresseeId_status_idx" ON "Friendship"("addresseeId", "status");
CREATE UNIQUE INDEX "Pack_slug_key" ON "Pack"("slug");
CREATE INDEX "Pack_city_idx" ON "Pack"("city");
CREATE INDEX "Pack_ownerId_idx" ON "Pack"("ownerId");
CREATE UNIQUE INDEX "PackMembership_packId_userId_key" ON "PackMembership"("packId", "userId");
CREATE INDEX "PackMembership_userId_idx" ON "PackMembership"("userId");
CREATE INDEX "PackMembership_dogId_idx" ON "PackMembership"("dogId");
CREATE INDEX "PackPost_packId_createdAt_idx" ON "PackPost"("packId", "createdAt");
CREATE INDEX "PackPost_authorId_idx" ON "PackPost"("authorId");

ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Pack" ADD CONSTRAINT "Pack_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PackMembership" ADD CONSTRAINT "PackMembership_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PackMembership" ADD CONSTRAINT "PackMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PackMembership" ADD CONSTRAINT "PackMembership_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PackPost" ADD CONSTRAINT "PackPost_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PackPost" ADD CONSTRAINT "PackPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
