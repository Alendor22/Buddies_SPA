ALTER TABLE "RecognitionEvent"
  ADD COLUMN "reporterUserId" TEXT,
  ADD COLUMN "photoStorageKey" TEXT,
  ADD COLUMN "photoExpiresAt" TIMESTAMP(3);

ALTER TABLE "RecognitionEvent"
  ADD CONSTRAINT "RecognitionEvent_reporterUserId_fkey"
  FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "RecognitionEvent_photoExpiresAt_idx" ON "RecognitionEvent"("photoExpiresAt");

CREATE TABLE "RecognitionEventCandidate" (
  "id" TEXT NOT NULL,
  "recognitionEventId" TEXT NOT NULL,
  "dogId" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RecognitionEventCandidate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecognitionEventCandidate_recognitionEventId_dogId_key"
  ON "RecognitionEventCandidate"("recognitionEventId", "dogId");

CREATE INDEX "RecognitionEventCandidate_dogId_createdAt_idx"
  ON "RecognitionEventCandidate"("dogId", "createdAt");

ALTER TABLE "RecognitionEventCandidate"
  ADD CONSTRAINT "RecognitionEventCandidate_recognitionEventId_fkey"
  FOREIGN KEY ("recognitionEventId") REFERENCES "RecognitionEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecognitionEventCandidate"
  ADD CONSTRAINT "RecognitionEventCandidate_dogId_fkey"
  FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RecognitionMatchMessage" (
  "id" TEXT NOT NULL,
  "recognitionEventId" TEXT NOT NULL,
  "dogId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RecognitionMatchMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecognitionMatchMessage_recognitionEventId_dogId_createdAt_idx"
  ON "RecognitionMatchMessage"("recognitionEventId", "dogId", "createdAt");

CREATE INDEX "RecognitionMatchMessage_senderId_createdAt_idx"
  ON "RecognitionMatchMessage"("senderId", "createdAt");

ALTER TABLE "RecognitionMatchMessage"
  ADD CONSTRAINT "RecognitionMatchMessage_recognitionEventId_fkey"
  FOREIGN KEY ("recognitionEventId") REFERENCES "RecognitionEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecognitionMatchMessage"
  ADD CONSTRAINT "RecognitionMatchMessage_dogId_fkey"
  FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecognitionMatchMessage"
  ADD CONSTRAINT "RecognitionMatchMessage_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
