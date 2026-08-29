import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('progressive auth error-security harness', () => {
  it('routes legacy password recovery into Clerk instead of exposing account state', () => {
    const page = readFileSync('src/app/auth/forgot-password/page.tsx', 'utf8');
    const middleware = readFileSync('src/middleware.ts', 'utf8');

    expect(page).toContain("redirect('/sign-in')");
    expect(middleware).toContain("'/auth/forgot-password': '/sign-in'");
    expect(page).not.toContain('findUnique');
    expect(page).not.toContain('emailVerifiedAt');
  });

  it('does not ship the legacy Resend password-reset delivery path', () => {
    const forgotPassword = readFileSync('src/app/auth/forgot-password/page.tsx', 'utf8');
    const resetPassword = readFileSync('src/app/auth/reset-password/page.tsx', 'utf8');

    expect(existsSync('src/lib/email.ts')).toBe(false);
    expect(forgotPassword).not.toContain('sendTransactionalEmail');
    expect(forgotPassword).not.toContain('RESEND_API_KEY');
    expect(resetPassword).not.toContain('verifyAuthToken');
    expect(resetPassword).toContain("redirect('/sign-in')");
  });

  it('requires the production Prisma runtime target and session-version migration', () => {
    const schema = readFileSync('prisma/schema.prisma', 'utf8');
    const migration = readFileSync(
      'prisma/migrations/20260828040000_user_session_version/migration.sql',
      'utf8',
    );

    expect(schema).toContain('binaryTargets = ["native", "rhel-openssl-3.0.x"]');
    expect(migration).toContain('ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0');
  });
});
