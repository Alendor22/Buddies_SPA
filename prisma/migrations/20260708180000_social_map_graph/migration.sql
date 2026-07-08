-- Social graph and map intelligence layer.
CREATE TYPE "DogPresenceStatus" AS ENUM ('NOT_ACTIVE', 'LIKELY_WALKING', 'WALKING', 'PAUSED', 'STALE', 'POSSIBLY_DRIVING');
CREATE TYPE "MapReportType" AS ENUM ('FRIENDLY_GROUP', 'LOOSE_DOG', 'AGGRESSIVE_DOG', 'WATER_BOWL', 'POOP_BAG_STATION', 'HAZARD', 'CROWDED_PARK', 'LOST_SIGHTING');

CREATE TABLE "RouteMemory" (
  "id" TEXT NOT NULL,
  "dogId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "neighborhoodKey" TEXT,
  "routeHash" TEXT NOT NULL,
  "routeGeometry" JSONB NOT NULL,
  "routeSteps" JSONB,
  "routeDistanceMiles" DOUBLE PRECISION,
  "routeDurationMin" INTEGER,
  "occurrences" INTEGER NOT NULL DEFAULT 1,
  "lastWalkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confidence" INTEGER NOT NULL DEFAULT 50,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RouteMemory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DogPresence" (
  "id" TEXT NOT NULL,
  "dogId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "walkId" TEXT,
  "status" "DogPresenceStatus" NOT NULL DEFAULT 'LIKELY_WALKING',
  "walkingScore" INTEGER NOT NULL DEFAULT 0,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "accuracyMeters" DOUBLE PRECISION,
  "speedMph" DOUBLE PRECISION,
  "heading" DOUBLE PRECISION,
  "neighborhoodKey" TEXT,
  "routeMemoryId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DogPresence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MapReport" (
  "id" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "dogId" TEXT,
  "type" "MapReportType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "neighborhoodKey" TEXT,
  "confirmations" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MapReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RouteMemory_dogId_routeHash_key" ON "RouteMemory"("dogId", "routeHash");
CREATE INDEX "RouteMemory_dogId_occurrences_idx" ON "RouteMemory"("dogId", "occurrences");
CREATE INDEX "RouteMemory_neighborhoodKey_lastWalkedAt_idx" ON "RouteMemory"("neighborhoodKey", "lastWalkedAt");

CREATE INDEX "DogPresence_dogId_lastHeartbeatAt_idx" ON "DogPresence"("dogId", "lastHeartbeatAt");
CREATE INDEX "DogPresence_ownerId_lastHeartbeatAt_idx" ON "DogPresence"("ownerId", "lastHeartbeatAt");
CREATE INDEX "DogPresence_neighborhoodKey_status_expiresAt_idx" ON "DogPresence"("neighborhoodKey", "status", "expiresAt");
CREATE INDEX "DogPresence_latitude_longitude_idx" ON "DogPresence"("latitude", "longitude");

CREATE INDEX "MapReport_type_expiresAt_idx" ON "MapReport"("type", "expiresAt");
CREATE INDEX "MapReport_neighborhoodKey_expiresAt_idx" ON "MapReport"("neighborhoodKey", "expiresAt");
CREATE INDEX "MapReport_latitude_longitude_idx" ON "MapReport"("latitude", "longitude");

ALTER TABLE "RouteMemory" ADD CONSTRAINT "RouteMemory_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DogPresence" ADD CONSTRAINT "DogPresence_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DogPresence" ADD CONSTRAINT "DogPresence_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DogPresence" ADD CONSTRAINT "DogPresence_walkId_fkey" FOREIGN KEY ("walkId") REFERENCES "Walk"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DogPresence" ADD CONSTRAINT "DogPresence_routeMemoryId_fkey" FOREIGN KEY ("routeMemoryId") REFERENCES "RouteMemory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MapReport" ADD CONSTRAINT "MapReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MapReport" ADD CONSTRAINT "MapReport_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
