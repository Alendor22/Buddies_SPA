#!/usr/bin/env node

const value = process.env.TEST_DATABASE_URL;
if (!value) {
  console.error('TEST_DATABASE_URL is required. The test harness will not fall back to DATABASE_URL.');
  process.exit(1);
}

let parsed;
try {
  parsed = new URL(value);
} catch {
  console.error('TEST_DATABASE_URL must be a valid PostgreSQL URL.');
  process.exit(1);
}

const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
const testName = /(^|[_-])test([_-]|$)/i;
if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !testName.test(databaseName)) {
  console.error(`Refusing database operation for non-test database "${databaseName || '(missing)'}".`);
  process.exit(1);
}

console.log(`Test database guard passed for "${databaseName}".`);
