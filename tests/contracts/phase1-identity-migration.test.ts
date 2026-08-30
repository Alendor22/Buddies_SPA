import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const schema = readFileSync('prisma/schema.prisma', 'utf8');
const migration = readFileSync(
  'prisma/migrations/20260830_01_user_preferences_households_custodians/migration.sql',
  'utf8',
);

describe('Phase 1 identity migration contract', () => {
  it('keeps legacy Dog.ownerId during additive rollout', () => {
    expect(schema).toContain('ownerId                  String');
    expect(schema).toContain('@relation(fields: [ownerId], references: [id], onDelete: Cascade)');
  });

  it('defines the new identity foundation models in Prisma', () => {
    for (const model of ['UserPreference', 'Household', 'HouseholdMember', 'DogCustodian']) {
      expect(schema).toContain(`model ${model} {`);
      expect(migration).toContain(`CREATE TABLE "${model}"`);
    }
    expect(schema).toContain('enum DogCustodianRole {');
    expect(migration).toContain('CREATE TYPE "DogCustodianRole"');
  });

  it('contains the owner-to-custodian backfill', () => {
    expect(migration).toContain('INSERT INTO "DogCustodian"');
    expect(migration).toContain("'OWNER'::\"DogCustodianRole\"");
    expect(migration).toContain('ON CONFLICT ("dogId", "userId") DO NOTHING');
  });

  it('is additive and contains no destructive DDL', () => {
    const destructive = [
      /DROP\s+TABLE/i,
      /DROP\s+COLUMN/i,
      /DROP\s+TYPE/i,
      /TRUNCATE/i,
      /DELETE\s+FROM\s+"Dog"/i,
      /ALTER\s+TABLE\s+"Dog"[\s\S]*DROP/i,
    ];

    for (const pattern of destructive) {
      expect(migration).not.toMatch(pattern);
    }
  });

  it('defines uniqueness needed for idempotent owner backfill', () => {
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "DogCustodian_dogId_userId_key" ON "DogCustodian"("dogId", "userId")',
    );
  });
});
