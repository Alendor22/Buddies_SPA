import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';

const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Phase 2 migrated social schema', () => {
  it('contains every Phase 2 social table after prisma migrate deploy', async () => {
    const expected = [
      'SocialPrivacy',
      'SocialBlock',
      'CheckIn',
      'Conversation',
      'ConversationMember',
      'SocialMessage',
      'SocialGroup',
      'SocialGroupMember',
      'ActivityFeedItem',
      'SocialEvent',
      'SocialEventAttendee',
      'ReputationEvent',
      'ModerationReport'
    ];

    const rows = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `;
    const actual = new Set(rows.map((row) => row.table_name));
    for (const table of expected) expect(actual.has(table), table).toBe(true);
  });

  it('enforces one block edge and one group membership per pair', async () => {
    const rows = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN ('SocialBlock_blockerId_blockedId_key', 'SocialGroupMember_groupId_userId_key', 'ConversationMember_conversationId_userId_key')
    `;
    expect(new Set(rows.map((row) => row.indexname))).toEqual(new Set([
      'SocialBlock_blockerId_blockedId_key',
      'SocialGroupMember_groupId_userId_key',
      'ConversationMember_conversationId_userId_key'
    ]));
  });

  it('keeps check-in and event query indexes available', async () => {
    const rows = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN ('CheckIn_expiresAt_idx', 'CheckIn_latitude_longitude_idx', 'SocialEvent_visibility_startsAt_idx')
    `;
    expect(rows).toHaveLength(3);
  });
});
