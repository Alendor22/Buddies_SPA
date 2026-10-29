ALTER TABLE "SocialMessage" ADD COLUMN "recipientDogId" TEXT;

ALTER TABLE "SocialMessage"
ADD CONSTRAINT "SocialMessage_recipientDogId_fkey"
FOREIGN KEY ("recipientDogId") REFERENCES "Dog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "SocialMessage_recipientDogId_createdAt_idx" ON "SocialMessage"("recipientDogId", "createdAt");
