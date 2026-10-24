import { readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { createTestPrismaClient } from '../support/test-database';

const prisma = createTestPrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

const scalarTypes = new Set(['String', 'Boolean', 'Int', 'BigInt', 'Float', 'Decimal', 'DateTime', 'Json', 'Bytes']);

function getExpectedColumns(schema) {
  const enumTypes = new Set(Array.from(schema.matchAll(/^enum\\s+(\\w+)\\s+\\{/gm), (match) => match[1]));
  const models = Array.from(schema.matchAll(/^model\\s+(\\w+)\\s+\\{([\\s\\S]*?)^\\}/gm), (match) => ({
    name: match[1],
    body: match[2]
  }));
  const expectedColumns = new Set();

  for (const model of models) {
    const mappedTable = model.body.match(/^\\s*@@map\\("([^"]+)"\\)/m)?.[1] ?? model.name;
    for (const line of model.body.split(/\\r?\\n/)) {
      const field = line.trim().match(/^(\\w+)\\s+([\\w\\[\\]?]+)(?:\\s+(.*))?$/);
      if (!field) continue;
      const [, fieldName, declaredType, attributes = ''] = field;
      const type = declaredType.replace(/[\\[\\]?]/g, '');
      if (!scalarTypes.has(type) && !enumTypes.has(type)) continue;
      const mappedField = attributes.match(/@map\\("([^"]+)"\\)/)?.[1] ?? fieldName;
      expectedColumns.add(mappedTable + '.' + mappedField);
    }
  }

  return { models, expectedColumns };
}

describe('fresh migration history', () => {
  it('creates every scalar field in the Prisma schema as a migrated column', async () => {
    const schema = readFileSync('prisma/schema.prisma', 'utf8');
    const { models, expectedColumns } = getExpectedColumns(schema);
    const columns = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
    `;
    const storedFields = new Set(columns.map((column) => column.table_name + '.' + column.column_name));
    const missing = Array.from(expectedColumns).filter((key) => !storedFields.has(key));

    expect(models.length).toBeGreaterThan(0);
    expect(expectedColumns.size).toBeGreaterThan(0);
    expect(missing, 'Every Prisma schema scalar field must be represented by a migration').toEqual([]);
  });
});
