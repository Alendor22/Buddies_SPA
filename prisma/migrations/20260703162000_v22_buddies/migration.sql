-- Buddies v2.2 social graph

CREATE TYPE "BuddyRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

CREATE TABLE "BuddyRequest" (
  "id" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "receiverId" TEXT NOT NULL,
  "status" "BuddyRequestStatus" NOT NULL DEFAULT 'PENDING',
  "message" TEXT,
  "respondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BuddyRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Buddy" (
  "id" TEXT NOT NULL,
  "userAId" TEXT NOT NULL,
  "userBId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Buddy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BuddyRequest_senderId_receiverId_key" ON "BuddyRequest"("senderId", "receiverId");
CREATE INDEX "BuddyRequest_receiverId_status_idx" ON "BuddyRequest"("receiverId", "status");
CREATE INDEX "BuddyRequest_senderId_status_idx" ON "BuddyRequest"("senderId", "status");

CREATE UNIQUE INDEX "Buddy_userAId_userBId_key" ON "Buddy"("userAId", "userBId");
CREATE INDEX "Buddy_userAId_idx" ON "Buddy"("userAId");
CREATE INDEX "Buddy_userBId_idx" ON "Buddy"("userBId");

ALTER TABLE "BuddyRequest" ADD CONSTRAINT "BuddyRequest_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BuddyRequest" ADD CONSTRAINT "BuddyRequest_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Buddy" ADD CONSTRAINT "Buddy_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Buddy" ADD CONSTRAINT "Buddy_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
