import { afterAll, describe, expect, it } from 'vitest';
import { Prisma, PrismaClient } from '@/generated/prisma/client';

const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

describe('fresh migration history', () => {
  it('creates every table and stored field required by the generated client', async () => {
    const columns = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
    `;
    const storedFields = new Set(columns.map((column) => `${column.table_name}.${column.column_name}`));
    const missing: string[] = [];

    for (const model of Prisma.dmmf.datamodel.models) {
      for (const field of model.fields.filter((candidate) => candidate.kind !== 'object')) {
        const key = `${model.dbName ?? model.name}.${field.dbName ?? field.name}`;
        if (!storedFields.has(key)) missing.push(key);
      }
    }

    expect(missing, 'Every Prisma field must be represented by a migration').toEqual([]);
  });
});
