ALTER TABLE "SocialMessage" ADD COLUMN "senderDogId" TEXT;

ALTER TABLE "SocialMessage"
ADD CONSTRAINT "SocialMessage_senderDogId_fkey"
FOREIGN KEY ("senderDogId") REFERENCES "Dog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "SocialMessage_senderDogId_createdAt_idx" ON "SocialMessage"("senderDogId", "createdAt");
