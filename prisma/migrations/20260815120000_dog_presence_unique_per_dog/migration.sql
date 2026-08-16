-- The presence endpoint now upserts a single live row per dog instead of inserting a new
-- row on every heartbeat. Collapse any pre-existing duplicates before enforcing uniqueness.
DELETE FROM "DogPresence" a USING "DogPresence" b
WHERE a."dogId" = b."dogId"
  AND (a."lastHeartbeatAt", a."id") < (b."lastHeartbeatAt", b."id");

CREATE UNIQUE INDEX "DogPresence_dogId_key" ON "DogPresence"("dogId");
