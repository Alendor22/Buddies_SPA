import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Clerk runtime contract', () => {
  it('uses Clerk as the application identity authority', () => {
    const authSource = readFileSync('src/lib/auth.ts', 'utf8');
    const schema = readFileSync('prisma/schema.prisma', 'utf8');

    expect(authSource).toContain("from '@clerk/nextjs/server'");
    expect(authSource).toContain('where: { clerkId }');
    expect(schema).toContain('clerkId');
  });

  it('keeps Clerk middleware enabled', () => {
    const middleware = readFileSync('src/middleware.ts', 'utf8');

    expect(middleware).toContain('clerkMiddleware');
  });

  it('gives the browser-test server secure Clerk runtime configuration', () => {
    const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
    const browserTests = workflow.split('  browser-tests:')[1];

    expect(browserTests).toBeDefined();
    expect(browserTests).toContain(
      '      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${{ vars.CLERK_PUBLISHABLE_KEY }}'
    );
    expect(browserTests).not.toMatch(
      /NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:\s*pk_(?:test|live)_/
    );
    expect(browserTests).toContain(
      '      CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}'
    );
    expect(browserTests).not.toMatch(/CLERK_SECRET_KEY:\s*sk_(?:test|live)_/);
  });

  it('keeps a local Playwright Clerk boot fallback', () => {
    const config = readFileSync('playwright.config.ts', 'utf8');

    expect(config).toContain('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
  });

  it('routes legacy entry points into Clerk', () => {
    const middleware = readFileSync('src/middleware.ts', 'utf8');
    expect(middleware).toContain('/auth/login');
    expect(middleware).toContain('/sign-in');
  });
});
