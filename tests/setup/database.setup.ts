import { assertTestDatabaseUrl } from '../support/test-database';

const testDatabaseUrl = assertTestDatabaseUrl(process.env.TEST_DATABASE_URL);

process.env.DATABASE_URL = testDatabaseUrl;
process.env.DATABASE_URL_UNPOOLED = testDatabaseUrl;
process.env.AUTH_SECRET ||= 'test-only-auth-secret-at-least-32-characters';
