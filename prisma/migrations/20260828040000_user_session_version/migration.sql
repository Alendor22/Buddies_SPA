-- Session revocation support.
-- Bumping a user's sessionVersion invalidates every session token issued to them,
-- which the previous sha256(userId + secret) scheme made impossible.
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
