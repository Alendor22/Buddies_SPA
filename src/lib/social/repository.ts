import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';

export type SocialPrivacy = {
  userId: string;
  discoverable: boolean;
  showCity: boolean;
  allowBuddyRequests: boolean;
  allowWalkInvites: boolean;
  allowMessages: boolean;
  showCheckIns: boolean;
  showActivity: boolean;
};

export async function getSocialPrivacy(userId: string) {
  const rows = await prisma.$queryRaw<SocialPrivacy[]>`
    SELECT "userId", "discoverable", "showCity", "allowBuddyRequests", "allowWalkInvites", "allowMessages", "showCheckIns", "showActivity"
    FROM "SocialPrivacy" WHERE "userId" = ${userId} LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function upsertSocialPrivacy(userId: string, value: Omit<SocialPrivacy, 'userId'>) {
  const rows = await prisma.$queryRaw<SocialPrivacy[]>`
    INSERT INTO "SocialPrivacy" ("userId", "discoverable", "showCity", "allowBuddyRequests", "allowWalkInvites", "allowMessages", "showCheckIns", "showActivity", "updatedAt")
    VALUES (${userId}, ${value.discoverable}, ${value.showCity}, ${value.allowBuddyRequests}, ${value.allowWalkInvites}, ${value.allowMessages}, ${value.showCheckIns}, ${value.showActivity}, CURRENT_TIMESTAMP)
    ON CONFLICT ("userId") DO UPDATE SET
      "discoverable" = EXCLUDED."discoverable", "showCity" = EXCLUDED."showCity", "allowBuddyRequests" = EXCLUDED."allowBuddyRequests",
      "allowWalkInvites" = EXCLUDED."allowWalkInvites", "allowMessages" = EXCLUDED."allowMessages", "showCheckIns" = EXCLUDED."showCheckIns",
      "showActivity" = EXCLUDED."showActivity", "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "userId", "discoverable", "showCity", "allowBuddyRequests", "allowWalkInvites", "allowMessages", "showCheckIns", "showActivity"
  `;
  return rows[0];
}

export async function listBlockedUserIds(userId: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT CASE WHEN "blockerId" = ${userId} THEN "blockedId" ELSE "blockerId" END AS id FROM "SocialBlock"
    WHERE "blockerId" = ${userId} OR "blockedId" = ${userId}
  `;
  return rows.map((row) => row.id);
}

export async function blockUser(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) throw new Error('Cannot block self');
  await prisma.$executeRaw`INSERT INTO "SocialBlock" ("id", "blockerId", "blockedId") VALUES (${randomUUID()}, ${blockerId}, ${blockedId}) ON CONFLICT ("blockerId", "blockedId") DO NOTHING`;
}

export async function createConversation(ownerId: string, memberId: string) {
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT c."id" FROM "Conversation" c
    WHERE c."kind" = 'DIRECT'
      AND EXISTS (SELECT 1 FROM "ConversationMember" a WHERE a."conversationId" = c."id" AND a."userId" = ${ownerId})
      AND EXISTS (SELECT 1 FROM "ConversationMember" b WHERE b."conversationId" = c."id" AND b."userId" = ${memberId})
      AND (SELECT COUNT(*) FROM "ConversationMember" m WHERE m."conversationId" = c."id") = 2
    LIMIT 1
  `;
  if (existing[0]?.id) return existing[0].id;

  const id = randomUUID();
  await prisma.$transaction([
    prisma.$executeRaw`INSERT INTO "Conversation" ("id", "kind") VALUES (${id}, 'DIRECT')`,
    prisma.$executeRaw`INSERT INTO "ConversationMember" ("id", "conversationId", "userId", "role") VALUES (${randomUUID()}, ${id}, ${ownerId}, 'OWNER')`,
    prisma.$executeRaw`INSERT INTO "ConversationMember" ("id", "conversationId", "userId", "role") VALUES (${randomUUID()}, ${id}, ${memberId}, 'MEMBER')`
  ]);
  return id;
}

export async function isConversationMember(conversationId: string, userId: string) {
  const rows = await prisma.$queryRaw<Array<{ ok: boolean }>>`SELECT true AS ok FROM "ConversationMember" WHERE "conversationId" = ${conversationId} AND "userId" = ${userId} LIMIT 1`;
  return Boolean(rows[0]?.ok);
}

// The other members of a conversation with their effective messaging preference.
// A missing SocialPrivacy row means the defaults apply, and allowMessages defaults to true.
export async function getConversationPeers(conversationId: string, userId: string) {
  return prisma.$queryRaw<Array<{ userId: string; allowMessages: boolean }>>`
    SELECT m."userId", COALESCE(p."allowMessages", true) AS "allowMessages"
    FROM "ConversationMember" m LEFT JOIN "SocialPrivacy" p ON p."userId" = m."userId"
    WHERE m."conversationId" = ${conversationId} AND m."userId" <> ${userId}
  `;
}

export async function listConversations(userId: string) {
  return prisma.$queryRaw<Array<{ id: string; kind: string; title: string | null; updatedAt: Date; peerId: string | null; peerName: string | null; peerAvatarUrl: string | null; lastBody: string | null; lastMessageAt: Date | null }>>`
    SELECT c."id", c."kind", c."title", c."updatedAt",
      peer."id" AS "peerId", peer."displayName" AS "peerName", peer."avatarUrl" AS "peerAvatarUrl",
      lm."body" AS "lastBody", lm."createdAt" AS "lastMessageAt"
    FROM "Conversation" c
    JOIN "ConversationMember" mine ON mine."conversationId" = c."id" AND mine."userId" = ${userId}
    LEFT JOIN "ConversationMember" other ON other."conversationId" = c."id" AND other."userId" <> ${userId}
    LEFT JOIN "User" peer ON peer."id" = other."userId"
    LEFT JOIN LATERAL (
      SELECT sm."body", sm."createdAt" FROM "SocialMessage" sm
      WHERE sm."conversationId" = c."id" AND sm."deletedAt" IS NULL ORDER BY sm."createdAt" DESC LIMIT 1
    ) lm ON true
    ORDER BY COALESCE(lm."createdAt", c."updatedAt") DESC LIMIT 100
  `;
}

export async function listMessages(conversationId: string) {
  return prisma.$queryRaw<Array<{ id: string; senderId: string; senderDogId: string | null; senderDogName: string | null; senderDogPhotoUrl: string | null; body: string; createdAt: Date }>>`
    SELECT sm."id", sm."senderId", sm."senderDogId", d."name" AS "senderDogName", d."photoUrl" AS "senderDogPhotoUrl", sm."body", sm."createdAt"
    FROM "SocialMessage" sm LEFT JOIN "Dog" d ON d."id" = sm."senderDogId"
    WHERE sm."conversationId" = ${conversationId} AND sm."deletedAt" IS NULL ORDER BY sm."createdAt" ASC LIMIT 200
  `;
}

export async function sendMessage(conversationId: string, senderId: string, body: string, senderDogId: string) {
  const id = randomUUID();
  await prisma.$transaction([
    prisma.$executeRaw`INSERT INTO "SocialMessage" ("id", "conversationId", "senderId", "senderDogId", "body") VALUES (${id}, ${conversationId}, ${senderId}, ${senderDogId}, ${body})`,
    prisma.$executeRaw`UPDATE "Conversation" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${conversationId}`
  ]);
  return id;
}

export async function createGroup(ownerId: string, name: string, description: string | null, city: string | null) {
  const id = randomUUID();
  await prisma.$transaction([
    prisma.$executeRaw`INSERT INTO "SocialGroup" ("id", "ownerId", "name", "description", "city") VALUES (${id}, ${ownerId}, ${name}, ${description}, ${city})`,
    prisma.$executeRaw`INSERT INTO "SocialGroupMember" ("id", "groupId", "userId", "role") VALUES (${randomUUID()}, ${id}, ${ownerId}, 'OWNER')`
  ]);
  return id;
}

export async function listGroups(userId: string) {
  return prisma.$queryRaw<Array<{ id: string; name: string; description: string | null; city: string | null; joined: boolean }>>`
    SELECT g."id", g."name", g."description", g."city", EXISTS(SELECT 1 FROM "SocialGroupMember" gm WHERE gm."groupId" = g."id" AND gm."userId" = ${userId}) AS joined
    FROM "SocialGroup" g WHERE g."visibility" = 'PUBLIC' OR g."ownerId" = ${userId} ORDER BY g."createdAt" DESC LIMIT 100
  `;
}

export async function addFeedItem(actorId: string, type: string, targetType?: string | null, targetId?: string | null) {
  await prisma.$executeRaw`INSERT INTO "ActivityFeedItem" ("id", "actorId", "type", "targetType", "targetId") VALUES (${randomUUID()}, ${actorId}, ${type}, ${targetType ?? null}, ${targetId ?? null})`;
}

export async function listFeed(userId: string) {
  return prisma.$queryRaw<Array<{ id: string; actorId: string; type: string; targetType: string | null; targetId: string | null; createdAt: Date }>>`
    SELECT f."id", f."actorId", f."type", f."targetType", f."targetId", f."createdAt" FROM "ActivityFeedItem" f
    WHERE f."actorId" = ${userId} OR EXISTS (SELECT 1 FROM "Buddy" b WHERE (b."userAId" = ${userId} AND b."userBId" = f."actorId") OR (b."userBId" = ${userId} AND b."userAId" = f."actorId"))
    ORDER BY f."createdAt" DESC LIMIT 100
  `;
}

export async function createEvent(hostId: string, title: string, startsAt: Date, description: string | null, locationName: string | null) {
  const id = randomUUID();
  await prisma.$transaction([
    prisma.$executeRaw`INSERT INTO "SocialEvent" ("id", "hostId", "title", "description", "locationName", "startsAt") VALUES (${id}, ${hostId}, ${title}, ${description}, ${locationName}, ${startsAt})`,
    prisma.$executeRaw`INSERT INTO "SocialEventAttendee" ("id", "eventId", "userId", "status") VALUES (${randomUUID()}, ${id}, ${hostId}, 'GOING')`
  ]);
  return id;
}

export async function listEvents(userId: string) {
  return prisma.$queryRaw<Array<{ id: string; title: string; locationName: string | null; startsAt: Date; hostId: string; attending: boolean }>>`
    SELECT e."id", e."title", e."locationName", e."startsAt", e."hostId", EXISTS(SELECT 1 FROM "SocialEventAttendee" a WHERE a."eventId" = e."id" AND a."userId" = ${userId} AND a."status" = 'GOING') AS attending
    FROM "SocialEvent" e WHERE e."startsAt" >= CURRENT_TIMESTAMP OR e."hostId" = ${userId} ORDER BY e."startsAt" ASC LIMIT 100
  `;
}

export async function reportContent(reporterId: string, targetType: string, targetId: string | null, category: string, details: string | null, targetUserId: string | null, targetDogId: string | null) {
  const id = randomUUID();
  await prisma.$executeRaw`INSERT INTO "ModerationReport" ("id", "reporterId", "targetUserId", "targetDogId", "targetType", "targetId", "category", "details") VALUES (${id}, ${reporterId}, ${targetUserId}, ${targetDogId}, ${targetType}, ${targetId}, ${category}, ${details})`;
  return id;
}

export async function getReputation(userId: string) {
  const rows = await prisma.$queryRaw<Array<{ score: number }>>`SELECT COALESCE(SUM("points"), 0)::int AS score FROM "ReputationEvent" WHERE "userId" = ${userId}`;
  return rows[0]?.score ?? 0;
}
