import { afterAll, describe, expect, it } from 'vitest';

import { createTestPrismaClient } from '../support/test-database';
const prisma = createTestPrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

describe('recognition migrated schema', () => {
  it('contains recognition enrollment, asset, and event tables', async () => {
    const rows = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('RecognitionEnrollment', 'RecognitionAsset', 'RecognitionEvent')
    `;

    expect(new Set(rows.map((row) => row.table_name))).toEqual(new Set([
      'RecognitionEnrollment',
      'RecognitionAsset',
      'RecognitionEvent'
    ]));
  });

  it('keeps dog enrollment and asset content hashes unique', async () => {
    const rows = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'RecognitionEnrollment_dogId_key',
          'RecognitionAsset_enrollmentId_contentHash_key',
          'RecognitionEvent_requestId_key'
        )
    `;

    expect(new Set(rows.map((row) => row.indexname))).toEqual(new Set([
      'RecognitionEnrollment_dogId_key',
      'RecognitionAsset_enrollmentId_contentHash_key',
      'RecognitionEvent_requestId_key'
    ]));
  });

  it('retains the enrollment ownership and matched-dog foreign keys', async () => {
    const rows = await prisma.$queryRaw<Array<{ constraint_name: string }>>`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE constraint_schema = 'public'
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name IN (
          'RecognitionEnrollment_dogId_fkey',
          'RecognitionEnrollment_ownerId_fkey',
          'RecognitionAsset_enrollmentId_fkey',
          'RecognitionEvent_matchedDogId_fkey'
        )
    `;

    expect(new Set(rows.map((row) => row.constraint_name))).toEqual(new Set([
      'RecognitionEnrollment_dogId_fkey',
      'RecognitionEnrollment_ownerId_fkey',
      'RecognitionAsset_enrollmentId_fkey',
      'RecognitionEvent_matchedDogId_fkey'
    ]));
  });
});
