import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Prisma deployment runtime contract', () => {
  it('generates the query engine required by Vercel functions', () => {
    const schema = readFileSync('prisma/schema.prisma', 'utf8');

    expect(schema).toContain('binaryTargets = ["native", "rhel-openssl-3.0.x"]');
  });
});
