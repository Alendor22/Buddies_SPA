DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MESSAGE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "messageId" TEXT;

CREATE INDEX IF NOT EXISTS "Notification_messageId_idx" ON "Notification"("messageId");

DO $$ BEGIN
  ALTER TABLE "Notification" ADD CONSTRAINT "Notification_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
