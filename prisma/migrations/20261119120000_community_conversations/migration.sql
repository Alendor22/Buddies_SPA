ALTER TABLE "Conversation"
  ADD COLUMN "dogPackId" TEXT,
  ADD COLUMN "eventId" TEXT;

CREATE UNIQUE INDEX "Conversation_dogPackId_key" ON "Conversation"("dogPackId");
CREATE UNIQUE INDEX "Conversation_eventId_key" ON "Conversation"("eventId");

ALTER TABLE "Conversation"
  ADD CONSTRAINT "Conversation_dogPackId_fkey"
    FOREIGN KEY ("dogPackId") REFERENCES "DogPack"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Conversation_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "SocialEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Give existing packs and meetups their own durable history before the UI ships.
INSERT INTO "Conversation" ("id", "kind", "title", "dogPackId")
SELECT md5(random()::text || clock_timestamp()::text), 'PACK', 'Pack: ' || p."name", p."id"
FROM "DogPack" p
ON CONFLICT ("dogPackId") DO NOTHING;

INSERT INTO "ConversationMember" ("id", "conversationId", "userId", "role")
SELECT md5(random()::text || clock_timestamp()::text), c."id", member."userId",
       CASE WHEN member."userId" = p."ownerId" THEN 'OWNER' ELSE 'MEMBER' END
FROM "DogPack" p
JOIN "Conversation" c ON c."dogPackId" = p."id"
JOIN (
  SELECT pack."id" AS "packId", pack."ownerId" AS "userId" FROM "DogPack" pack
  UNION
  SELECT membership."packId", membership."userId" FROM "DogPackMember" membership WHERE membership."status" = 'ACCEPTED'
) member ON member."packId" = p."id"
ON CONFLICT ("conversationId", "userId") DO NOTHING;

INSERT INTO "SocialEventAttendee" ("id", "eventId", "userId", "status")
SELECT md5(random()::text || clock_timestamp()::text), e."id", member."userId", 'GOING'
FROM "SocialEvent" e
JOIN "DogPackMember" member ON member."packId" = e."packId" AND member."status" = 'ACCEPTED'
WHERE e."packId" IS NOT NULL
ON CONFLICT ("eventId", "userId") DO NOTHING;

INSERT INTO "Conversation" ("id", "kind", "title", "eventId")
SELECT md5(random()::text || clock_timestamp()::text), 'EVENT', 'Meetup: ' || e."title", e."id"
FROM "SocialEvent" e
ON CONFLICT ("eventId") DO NOTHING;

INSERT INTO "ConversationMember" ("id", "conversationId", "userId", "role")
SELECT md5(random()::text || clock_timestamp()::text), c."id", attendee."userId",
       CASE WHEN attendee."userId" = e."hostId" THEN 'OWNER' ELSE 'MEMBER' END
FROM "SocialEvent" e
JOIN "Conversation" c ON c."eventId" = e."id"
JOIN (
  SELECT event."id" AS "eventId", event."hostId" AS "userId" FROM "SocialEvent" event
  UNION
  SELECT attendance."eventId", attendance."userId" FROM "SocialEventAttendee" attendance WHERE attendance."status" = 'GOING'
) attendee ON attendee."eventId" = e."id"
ON CONFLICT ("conversationId", "userId") DO NOTHING;
