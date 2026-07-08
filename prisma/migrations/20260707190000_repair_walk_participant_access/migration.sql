UPDATE "Walk" AS walk
SET "walkerId" = accepted."ownerId"
FROM (
  SELECT DISTINCT ON (invitation."walkId")
    invitation."walkId",
    dog."ownerId"
  FROM "WalkInvitation" AS invitation
  JOIN "Dog" AS dog ON dog."id" = invitation."invitedDogId"
  WHERE invitation."status" = 'ACCEPTED'
  ORDER BY invitation."walkId", invitation."respondedAt" ASC NULLS LAST, invitation."createdAt" ASC
) AS accepted
WHERE walk."id" = accepted."walkId"
  AND walk."walkerId" IS DISTINCT FROM accepted."ownerId";

UPDATE "Walk" AS walk
SET "walkerId" = NULL
WHERE walk."walkerId" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "WalkInvitation" AS invitation
    WHERE invitation."walkId" = walk."id"
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "WalkInvitation" AS invitation
    JOIN "Dog" AS dog ON dog."id" = invitation."invitedDogId"
    WHERE invitation."walkId" = walk."id"
      AND invitation."status" = 'ACCEPTED'
      AND dog."ownerId" = walk."walkerId"
  );
