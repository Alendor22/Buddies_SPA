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
