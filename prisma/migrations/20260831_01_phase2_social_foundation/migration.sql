-- Phase 2 Social foundation. Additive only; existing buddy, walk-invite and walk-message models remain intact.

CREATE TABLE "SocialPrivacy" (
  "userId" TEXT NOT NULL,
  "discoverable" BOOLEAN NOT NULL DEFAULT true,
  "showCity" BOOLEAN NOT NULL DEFAULT true,
  "allowBuddyRequests" BOOLEAN NOT NULL DEFAULT true,
  "allowWalkInvites" BOOLEAN NOT NULL DEFAULT true,
  "allowMessages" BOOLEAN NOT NULL DEFAULT true,
  "showCheckIns" BOOLEAN NOT NULL DEFAULT true,
  "showActivity" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialPrivacy_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "SocialBlock" (
  "id" TEXT NOT NULL,
  "blockerId" TEXT NOT NULL,
  "blockedId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialBlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialBlock_blockerId_blockedId_key" ON "SocialBlock"("blockerId", "blockedId");
CREATE INDEX "SocialBlock_blockedId_idx" ON "SocialBlock"("blockedId");

CREATE TABLE "CheckIn" (
  "id" TEXT NOT NULL,
  "dogId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "placeName" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "note" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CheckIn_dogId_createdAt_idx" ON "CheckIn"("dogId", "createdAt");
CREATE INDEX "CheckIn_userId_createdAt_idx" ON "CheckIn"("userId", "createdAt");
CREATE INDEX "CheckIn_expiresAt_idx" ON "CheckIn"("expiresAt");
CREATE INDEX "CheckIn_latitude_longitude_idx" ON "CheckIn"("latitude", "longitude");

CREATE TABLE "Conversation" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'DIRECT',
  "title" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConversationMember" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'MEMBER',
  "lastReadAt" TIMESTAMP(3),
  "mutedAt" TIMESTAMP(3),
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConversationMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConversationMember_conversationId_userId_key" ON "ConversationMember"("conversationId", "userId");
CREATE INDEX "ConversationMember_userId_joinedAt_idx" ON "ConversationMember"("userId", "joinedAt");

CREATE TABLE "SocialMessage" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "editedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SocialMessage_conversationId_createdAt_idx" ON "SocialMessage"("conversationId", "createdAt");
CREATE INDEX "SocialMessage_senderId_createdAt_idx" ON "SocialMessage"("senderId", "createdAt");

CREATE TABLE "SocialGroup" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "city" TEXT,
  "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialGroup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SocialGroup_ownerId_createdAt_idx" ON "SocialGroup"("ownerId", "createdAt");
CREATE INDEX "SocialGroup_city_visibility_idx" ON "SocialGroup"("city", "visibility");

CREATE TABLE "SocialGroupMember" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'MEMBER',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialGroupMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialGroupMember_groupId_userId_key" ON "SocialGroupMember"("groupId", "userId");
CREATE INDEX "SocialGroupMember_userId_joinedAt_idx" ON "SocialGroupMember"("userId", "joinedAt");

CREATE TABLE "ActivityFeedItem" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "dogId" TEXT,
  "type" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "audience" TEXT NOT NULL DEFAULT 'BUDDIES',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityFeedItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ActivityFeedItem_actorId_createdAt_idx" ON "ActivityFeedItem"("actorId", "createdAt");
CREATE INDEX "ActivityFeedItem_dogId_createdAt_idx" ON "ActivityFeedItem"("dogId", "createdAt");
CREATE INDEX "ActivityFeedItem_audience_createdAt_idx" ON "ActivityFeedItem"("audience", "createdAt");

CREATE TABLE "SocialEvent" (
  "id" TEXT NOT NULL,
  "hostId" TEXT NOT NULL,
  "groupId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "locationName" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
  "maxAttendees" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SocialEvent_hostId_startsAt_idx" ON "SocialEvent"("hostId", "startsAt");
CREATE INDEX "SocialEvent_groupId_startsAt_idx" ON "SocialEvent"("groupId", "startsAt");
CREATE INDEX "SocialEvent_visibility_startsAt_idx" ON "SocialEvent"("visibility", "startsAt");

CREATE TABLE "SocialEventAttendee" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'GOING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialEventAttendee_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialEventAttendee_eventId_userId_key" ON "SocialEventAttendee"("eventId", "userId");
CREATE INDEX "SocialEventAttendee_userId_createdAt_idx" ON "SocialEventAttendee"("userId", "createdAt");

CREATE TABLE "ReputationEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "actorId" TEXT,
  "kind" TEXT NOT NULL,
  "points" INTEGER NOT NULL DEFAULT 0,
  "reason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReputationEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReputationEvent_userId_createdAt_idx" ON "ReputationEvent"("userId", "createdAt");

CREATE TABLE "ModerationReport" (
  "id" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "targetUserId" TEXT,
  "targetDogId" TEXT,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "category" TEXT NOT NULL,
  "details" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModerationReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ModerationReport_reporterId_createdAt_idx" ON "ModerationReport"("reporterId", "createdAt");
CREATE INDEX "ModerationReport_status_createdAt_idx" ON "ModerationReport"("status", "createdAt");
CREATE INDEX "ModerationReport_targetUserId_createdAt_idx" ON "ModerationReport"("targetUserId", "createdAt");

ALTER TABLE "SocialPrivacy" ADD CONSTRAINT "SocialPrivacy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialBlock" ADD CONSTRAINT "SocialBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialBlock" ADD CONSTRAINT "SocialBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialMessage" ADD CONSTRAINT "SocialMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialMessage" ADD CONSTRAINT "SocialMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialGroup" ADD CONSTRAINT "SocialGroup_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialGroupMember" ADD CONSTRAINT "SocialGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "SocialGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialGroupMember" ADD CONSTRAINT "SocialGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityFeedItem" ADD CONSTRAINT "ActivityFeedItem_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityFeedItem" ADD CONSTRAINT "ActivityFeedItem_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SocialEvent" ADD CONSTRAINT "SocialEvent_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialEvent" ADD CONSTRAINT "SocialEvent_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "SocialGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SocialEventAttendee" ADD CONSTRAINT "SocialEventAttendee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "SocialEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialEventAttendee" ADD CONSTRAINT "SocialEventAttendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReputationEvent" ADD CONSTRAINT "ReputationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReputationEvent" ADD CONSTRAINT "ReputationEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ModerationReport" ADD CONSTRAINT "ModerationReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModerationReport" ADD CONSTRAINT "ModerationReport_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ModerationReport" ADD CONSTRAINT "ModerationReport_targetDogId_fkey" FOREIGN KEY ("targetDogId") REFERENCES "Dog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing users inherit conservative but usable social defaults without inventing consent.
INSERT INTO "SocialPrivacy" ("userId") SELECT "id" FROM "User" ON CONFLICT ("userId") DO NOTHING;
