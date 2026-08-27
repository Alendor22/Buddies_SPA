const TEST_DATABASE_NAME = /(^|[_-])test([_-]|$)/i;

export function assertTestDatabaseUrl(value: string | undefined) {
  if (!value) {
    throw new Error('TEST_DATABASE_URL is required for database tests. Production DATABASE_URL is never used as a fallback.');
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL URL.');
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !TEST_DATABASE_NAME.test(databaseName)) {
    throw new Error(`Refusing database tests for non-test database "${databaseName || '(missing)'}".`);
  }

  return value;
}
