import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Prisma deployment runtime contract', () => {
  it('generates the query engine required by Vercel functions', () => {
    const schema = readFileSync('prisma/schema.prisma', 'utf8');

    expect(schema).toContain('binaryTargets = ["native", "rhel-openssl-3.0.x"]');
  });

  it('creates dog profile fields before notification backfills use them', () => {
    const profileMigration =
      'prisma/migrations/20260703170000_user_dog_profile_fields/migration.sql';
    const notificationMigration =
      'prisma/migrations/20260707020000_phase1_notifications_walk_invitations/migration.sql';
    const migration = readFileSync(profileMigration, 'utf8');

    expect(profileMigration.localeCompare(notificationMigration)).toBeLessThan(0);
    expect(migration).toContain(
      'ALTER TABLE "Dog" ADD COLUMN IF NOT EXISTS "lastSeenLocation" TEXT;',
    );
    expect(migration).toContain(
      'ALTER TABLE "Dog" ADD COLUMN IF NOT EXISTS "lostSince" TIMESTAMP(3);',
    );
  });
});
