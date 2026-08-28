import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('progressive auth error-security harness', () => {
  it('keeps password-reset responses enumeration-safe', () => {
    const page = readFileSync('src/app/auth/forgot-password/page.tsx', 'utf8');

    expect(page).toContain("redirect('/auth/forgot-password?sent=1')");
    expect(page).toContain('If that address belongs to a verified Buddies account');
    expect(page).not.toContain('Email delivery failed');
  });

  it('does not silently discard password-reset delivery failures', () => {
    const page = readFileSync('src/app/auth/forgot-password/page.tsx', 'utf8');
    const email = readFileSync('src/lib/email.ts', 'utf8');

    expect(page).not.toContain('.catch(() => null)');
    expect(page).toContain('password_reset_email_delivery_failed');
    expect(email).toContain('auth_email_not_configured');
    expect(email).toContain('auth_email_provider_error');
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
