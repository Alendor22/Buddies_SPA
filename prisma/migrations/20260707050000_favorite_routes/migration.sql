CREATE TABLE IF NOT EXISTS "FavoriteRoute" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "dogId" TEXT,
  "name" TEXT NOT NULL,
  "routeEngine" TEXT,
  "plan" JSONB NOT NULL,
  "routeGeometry" JSONB NOT NULL,
  "routeSteps" JSONB,
  "routeDistanceMiles" DOUBLE PRECISION,
  "routeDurationMin" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FavoriteRoute_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FavoriteRoute_ownerId_createdAt_idx" ON "FavoriteRoute"("ownerId", "createdAt");
CREATE INDEX IF NOT EXISTS "FavoriteRoute_dogId_idx" ON "FavoriteRoute"("dogId");

DO $$ BEGIN
  ALTER TABLE "FavoriteRoute" ADD CONSTRAINT "FavoriteRoute_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FavoriteRoute" ADD CONSTRAINT "FavoriteRoute_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
