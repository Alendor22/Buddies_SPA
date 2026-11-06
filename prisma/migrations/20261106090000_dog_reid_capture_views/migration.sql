CREATE TYPE "RecognitionCaptureView" AS ENUM (
  'FRONT_LEFT', 'FRONT_CENTER', 'FRONT_RIGHT',
  'REAR_LEFT', 'REAR_CENTER', 'REAR_RIGHT',
  'LEFT_HEAD_ON', 'RIGHT_HEAD_ON'
);

ALTER TABLE "RecognitionAsset"
  ADD COLUMN "captureView" "RecognitionCaptureView";

CREATE INDEX "RecognitionAsset_enrollmentId_captureView_status_idx"
  ON "RecognitionAsset"("enrollmentId", "captureView", "status");
