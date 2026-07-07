DO $$ BEGIN
  CREATE TYPE "WalkInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationType" AS ENUM ('BUDDY_REQUEST', 'WALK_INVITE', 'WALK_STATUS', 'DOG_LOST', 'DOG_FOUND', 'DOG_SIGHTING', 'VET_REMINDER', 'SYSTEM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "WalkInvitation" (
  "id" TEXT NOT NULL,
  "walkId" TEXT NOT NULL,
  "senderDogId" TEXT NOT NULL,
  "invitedDogId" TEXT NOT NULL,
  "status" "WalkInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "message" TEXT,
  "respondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WalkInvitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "routeKey" TEXT NOT NULL,
  "href" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "dogId" TEXT,
  "walkId" TEXT,
  "walkInvitationId" TEXT,
  "buddyRequestId" TEXT,
  "sightingId" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WalkInvitation_walkId_invitedDogId_key" ON "WalkInvitation"("walkId", "invitedDogId");
CREATE INDEX IF NOT EXISTS "WalkInvitation_senderDogId_status_idx" ON "WalkInvitation"("senderDogId", "status");
CREATE INDEX IF NOT EXISTS "WalkInvitation_invitedDogId_status_idx" ON "WalkInvitation"("invitedDogId", "status");
CREATE INDEX IF NOT EXISTS "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_routeKey_createdAt_idx" ON "Notification"("routeKey", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_dogId_idx" ON "Notification"("dogId");
CREATE INDEX IF NOT EXISTS "Notification_walkId_idx" ON "Notification"("walkId");

DO $$ BEGIN
  ALTER TABLE "WalkInvitation" ADD CONSTRAINT "WalkInvitation_walkId_fkey" FOREIGN KEY ("walkId") REFERENCES "Walk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "WalkInvitation" ADD CONSTRAINT "WalkInvitation_senderDogId_fkey" FOREIGN KEY ("senderDogId") REFERENCES "Dog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "WalkInvitation" ADD CONSTRAINT "WalkInvitation_invitedDogId_fkey" FOREIGN KEY ("invitedDogId") REFERENCES "Dog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Notification" ADD CONSTRAINT "Notification_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Notification" ADD CONSTRAINT "Notification_walkId_fkey" FOREIGN KEY ("walkId") REFERENCES "Walk"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Notification" ADD CONSTRAINT "Notification_walkInvitationId_fkey" FOREIGN KEY ("walkInvitationId") REFERENCES "WalkInvitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Notification" ADD CONSTRAINT "Notification_buddyRequestId_fkey" FOREIGN KEY ("buddyRequestId") REFERENCES "BuddyRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Notification" ADD CONSTRAINT "Notification_sightingId_fkey" FOREIGN KEY ("sightingId") REFERENCES "Sighting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO "WalkInvitation" ("id", "walkId", "senderDogId", "invitedDogId", "status", "message", "createdAt", "updatedAt")
SELECT
  'winv_' || md5(w."id" || d."id"),
  w."id",
  w."dogId",
  d."id",
  CASE w."status"::text
    WHEN 'ACCEPTED' THEN 'ACCEPTED'::"WalkInvitationStatus"
    WHEN 'CANCELLED' THEN 'CANCELLED'::"WalkInvitationStatus"
    ELSE 'PENDING'::"WalkInvitationStatus"
  END,
  w."notes",
  w."createdAt",
  w."updatedAt"
FROM "Walk" w
JOIN LATERAL (
  SELECT d1."id"
  FROM "Dog" d1
  WHERE d1."ownerId" = w."walkerId"
  ORDER BY d1."createdAt" ASC
  LIMIT 1
) d ON TRUE
WHERE w."walkerId" IS NOT NULL
ON CONFLICT ("walkId", "invitedDogId") DO NOTHING;

INSERT INTO "Notification" ("id", "userId", "type", "routeKey", "href", "title", "body", "buddyRequestId", "createdAt")
SELECT
  'notif_br_' || md5(br."id"),
  br."receiverId",
  'BUDDY_REQUEST'::"NotificationType",
  'buddyRequests',
  '/dashboard/buddies#buddy-requests',
  'New buddy request',
  COALESCE(br."message", 'A dog profile wants to connect.'),
  br."id",
  br."createdAt"
FROM "BuddyRequest" br
WHERE br."status" = 'PENDING'
AND NOT EXISTS (SELECT 1 FROM "Notification" n WHERE n."buddyRequestId" = br."id" AND n."userId" = br."receiverId");

INSERT INTO "Notification" ("id", "userId", "type", "routeKey", "href", "title", "body", "dogId", "createdAt")
SELECT
  'notif_lost_' || md5(d."id"),
  d."ownerId",
  'DOG_LOST'::"NotificationType",
  'lostDog',
  '/dogs/' || d."slug" || '#lost-dog',
  d."name" || ' is marked lost',
  COALESCE(d."lastSeenLocation", 'Open the lost-dog profile for details.'),
  d."id",
  COALESCE(d."lostSince", d."updatedAt")
FROM "Dog" d
WHERE d."status" <> 'SAFE'
AND NOT EXISTS (SELECT 1 FROM "Notification" n WHERE n."dogId" = d."id" AND n."type" = 'DOG_LOST');

INSERT INTO "Notification" ("id", "userId", "type", "routeKey", "href", "title", "body", "dogId", "walkId", "walkInvitationId", "createdAt")
SELECT
  'notif_wi_' || md5(wi."id"),
  invited."ownerId",
  'WALK_INVITE'::"NotificationType",
  'walkInvites',
  '/dogs/' || invited."slug" || '#walk-invitations',
  sender."name" || ' invited ' || invited."name" || ' to a walk',
  COALESCE(wi."message", 'Open the dog profile to review the invitation.'),
  invited."id",
  wi."walkId",
  wi."id",
  wi."createdAt"
FROM "WalkInvitation" wi
JOIN "Dog" invited ON invited."id" = wi."invitedDogId"
JOIN "Dog" sender ON sender."id" = wi."senderDogId"
WHERE wi."status" = 'PENDING'
AND NOT EXISTS (SELECT 1 FROM "Notification" n WHERE n."walkInvitationId" = wi."id" AND n."userId" = invited."ownerId");
