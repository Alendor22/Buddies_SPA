-- Realigns the DogPresence index with the query that actually runs.
--
-- /api/social-map filters on neighborhoodKey (equality) and expiresAt (range),
-- then orders by lastHeartbeatAt. The existing index led with neighborhoodKey
-- but continued with status, which that query never constrains, so Postgres
-- could only use the first column and had to sort the result separately.
--
-- CONCURRENTLY is deliberately not used: it cannot run inside the transaction
-- Prisma wraps each migration in. DogPresence holds one row per actively
-- walking dog, so the exclusive lock is brief at current volume.

CREATE INDEX IF NOT EXISTS "DogPresence_neighborhoodKey_expiresAt_lastHeartbeatAt_idx"
  ON "DogPresence"("neighborhoodKey", "expiresAt", "lastHeartbeatAt");

-- Nothing queries DogPresence by status, and this is a heartbeat table where
-- every write pays for every index it carries.
DROP INDEX IF EXISTS "DogPresence_neighborhoodKey_status_expiresAt_idx";
