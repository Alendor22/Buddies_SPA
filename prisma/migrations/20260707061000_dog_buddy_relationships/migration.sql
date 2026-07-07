CREATE TABLE IF NOT EXISTS "DogBuddyRequest" (
  "id" TEXT NOT NULL,
  "senderDogId" TEXT NOT NULL,
  "receiverDogId" TEXT NOT NULL,
  "status" "BuddyRequestStatus" NOT NULL DEFAULT 'PENDING',
  "message" TEXT,
  "respondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DogBuddyRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DogBuddy" (
  "id" TEXT NOT NULL,
  "dogAId" TEXT NOT NULL,
  "dogBId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DogBuddy_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "dogBuddyRequestId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "DogBuddyRequest_senderDogId_receiverDogId_key" ON "DogBuddyRequest"("senderDogId", "receiverDogId");
CREATE INDEX IF NOT EXISTS "DogBuddyRequest_receiverDogId_status_idx" ON "DogBuddyRequest"("receiverDogId", "status");
CREATE INDEX IF NOT EXISTS "DogBuddyRequest_senderDogId_status_idx" ON "DogBuddyRequest"("senderDogId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "DogBuddy_dogAId_dogBId_key" ON "DogBuddy"("dogAId", "dogBId");
CREATE INDEX IF NOT EXISTS "DogBuddy_dogAId_idx" ON "DogBuddy"("dogAId");
CREATE INDEX IF NOT EXISTS "DogBuddy_dogBId_idx" ON "DogBuddy"("dogBId");
CREATE INDEX IF NOT EXISTS "Notification_dogBuddyRequestId_idx" ON "Notification"("dogBuddyRequestId");

DO $$ BEGIN
  ALTER TABLE "DogBuddyRequest" ADD CONSTRAINT "DogBuddyRequest_senderDogId_fkey" FOREIGN KEY ("senderDogId") REFERENCES "Dog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DogBuddyRequest" ADD CONSTRAINT "DogBuddyRequest_receiverDogId_fkey" FOREIGN KEY ("receiverDogId") REFERENCES "Dog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DogBuddy" ADD CONSTRAINT "DogBuddy_dogAId_fkey" FOREIGN KEY ("dogAId") REFERENCES "Dog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DogBuddy" ADD CONSTRAINT "DogBuddy_dogBId_fkey" FOREIGN KEY ("dogBId") REFERENCES "Dog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Notification" ADD CONSTRAINT "Notification_dogBuddyRequestId_fkey" FOREIGN KEY ("dogBuddyRequestId") REFERENCES "DogBuddyRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO "DogBuddyRequest" ("id", "senderDogId", "receiverDogId", "status", "message", "respondedAt", "createdAt", "updatedAt")
SELECT
  'dbr_' || md5(br."id" || sender_dog."id" || receiver_dog."id"),
  sender_dog."id",
  receiver_dog."id",
  br."status",
  br."message",
  br."respondedAt",
  br."createdAt",
  br."updatedAt"
FROM "BuddyRequest" br
JOIN LATERAL (
  SELECT d."id" FROM "Dog" d WHERE d."ownerId" = br."senderId" ORDER BY d."createdAt" ASC LIMIT 1
) sender_dog ON TRUE
JOIN LATERAL (
  SELECT d."id" FROM "Dog" d WHERE d."ownerId" = br."receiverId" ORDER BY d."createdAt" ASC LIMIT 1
) receiver_dog ON TRUE
ON CONFLICT ("senderDogId", "receiverDogId") DO NOTHING;

INSERT INTO "DogBuddy" ("id", "dogAId", "dogBId", "createdAt")
SELECT
  'db_' || md5(LEAST(dog_a."id", dog_b."id") || GREATEST(dog_a."id", dog_b."id")),
  LEAST(dog_a."id", dog_b."id"),
  GREATEST(dog_a."id", dog_b."id"),
  b."createdAt"
FROM "Buddy" b
JOIN LATERAL (
  SELECT d."id" FROM "Dog" d WHERE d."ownerId" = b."userAId" ORDER BY d."createdAt" ASC LIMIT 1
) dog_a ON TRUE
JOIN LATERAL (
  SELECT d."id" FROM "Dog" d WHERE d."ownerId" = b."userBId" ORDER BY d."createdAt" ASC LIMIT 1
) dog_b ON TRUE
ON CONFLICT ("dogAId", "dogBId") DO NOTHING;
