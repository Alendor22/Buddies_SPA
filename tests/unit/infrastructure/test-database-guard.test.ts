import { describe, expect, it } from 'vitest';
import { assertTestDatabaseUrl } from '../../support/test-database';

describe('test database guard', () => {
  it.each([
    'postgresql://postgres:postgres@localhost:5432/buddies_test',
    'postgres://postgres:postgres@localhost:5432/test-buddies'
  ])('accepts an explicitly test-named PostgreSQL database', (url) => {
    expect(assertTestDatabaseUrl(url)).toBe(url);
  });

  it.each([
    undefined,
    'not-a-url',
    'mysql://root:root@localhost/buddies_test',
    'postgresql://postgres:postgres@localhost:5432/buddies'
  ])('refuses unsafe database target %s', (url) => {
    expect(() => assertTestDatabaseUrl(url)).toThrow();
  });
});
