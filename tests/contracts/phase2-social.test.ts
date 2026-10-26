import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const migrationPath = `${root}/prisma/migrations/20260831_01_phase2_social_foundation/migration.sql`;
const migration = readFileSync(migrationPath, 'utf8');
const senderDogMigrationPath = `${root}/prisma/migrations/20260904_01_sender_dog_social_messages/migration.sql`;
const senderDogMigration = readFileSync(senderDogMigrationPath, 'utf8');
const prismaSchema = readFileSync(`${root}/prisma/schema.prisma`, 'utf8');

const socialRoutes = [
  'src/app/api/social/discovery/route.ts',
  'src/app/api/social/conversations/route.ts',
  'src/app/api/social/conversations/[id]/messages/route.ts',
  'src/app/api/social/groups/route.ts',
  'src/app/api/social/feed/route.ts',
  'src/app/api/social/privacy/route.ts',
  'src/app/api/social/events/route.ts',
  'src/app/api/social/moderation/route.ts',
  'src/app/api/social/reputation/route.ts',
  'src/app/dashboard/social/page.tsx'
];

describe('Phase 2 social deployment contracts', () => {
  it('ships the additive social migration and every authoritative table', () => {
    expect(existsSync(migrationPath)).toBe(true);
    for (const table of [
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
    ]) {
      expect(migration).toContain(`CREATE TABLE "${table}"`);
    }
  });

  it('remains non-destructive', () => {
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE)/i);
    expect(migration).not.toMatch(/TRUNCATE/i);
  });

  it('backfills social privacy without fabricating consent', () => {
    expect(migration).toContain('INSERT INTO "SocialPrivacy"');
    expect(migration).not.toMatch(/INSERT\s+INTO\s+"ConsentGrant"/i);
  });

  it('exposes all Phase 2 social APIs and dashboard surface', () => {
    for (const path of socialRoutes) expect(existsSync(`${root}/${path}`), path).toBe(true);
  });

  it('keeps Postgres authoritative for check-ins while Redis is best-effort acceleration', () => {
    const route = readFileSync(`${root}/src/app/api/check-ins/route.ts`, 'utf8');
    expect(route).toContain('INSERT INTO "CheckIn"');
    expect(route).toContain('DELETE FROM "CheckIn"');
    expect(route).toContain('Redis check-in acceleration unavailable; Postgres remains authoritative.');
    expect(route).not.toContain('Nearby check-ins require Upstash Redis configuration.');
  });

  it('enforces social privacy and blocking at discovery and conversation boundaries', () => {
    const discovery = readFileSync(`${root}/src/app/api/social/discovery/route.ts`, 'utf8');
    const conversations = readFileSync(`${root}/src/app/api/social/conversations/route.ts`, 'utf8');
    expect(discovery).toContain('listBlockedUserIds');
    expect(discovery).toContain('"discoverable" = true');
    expect(conversations).toContain('allowMessages');
    expect(conversations).toContain('blocked.includes(memberId)');
  });

  it('keeps dog-authored messages aligned across migration and Prisma schema', () => {
    expect(senderDogMigration).toContain('ADD COLUMN "senderDogId" TEXT');
    expect(senderDogMigration).toContain('ON DELETE SET NULL');
    expect(senderDogMigration).toContain('"SocialMessage_senderDogId_createdAt_idx"');
    expect(prismaSchema).toContain('socialMessages           SocialMessage[]         @relation("SocialMessageSenderDog")');
    expect(prismaSchema).toContain('senderDogId    String?');
    expect(prismaSchema).toContain('@relation("SocialMessageSenderDog", fields: [senderDogId], references: [id], onDelete: SetNull)');
    expect(prismaSchema).toContain('@@index([senderDogId, createdAt])');
  });
});
