import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  headers: vi.fn(),
  rateLimit: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  userFindUnique: vi.fn(),
  verifyPassword: vi.fn()
}));

vi.mock('next/headers', () => ({ headers: mocks.headers }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  createSession: mocks.createSession,
  verifyPassword: mocks.verifyPassword
}));
vi.mock('@/lib/db', () => ({ prisma: { user: { findUnique: mocks.userFindUnique } } }));
vi.mock('@/lib/rateLimit', () => ({
  clientIdentifier: vi.fn(() => '203.0.113.4'),
  rateLimit: mocks.rateLimit
}));

import { loginAction } from '@/app/auth/login/actions';

function loginForm(email = 'owner@example.test', password = 'correct-password') {
  const form = new FormData();
  form.set('email', email);
  form.set('password', password);
  return form;
}

describe('login server action', () => {
  beforeEach(() => {
    mocks.headers.mockResolvedValue(new Headers({ 'x-forwarded-for': '203.0.113.4' }));
    mocks.rateLimit.mockResolvedValue({ allowed: true, remaining: 4, retryAfterSeconds: 0 });
    mocks.verifyPassword.mockReturnValue(true);
  });

  it('rejects missing fields before rate limiting or database work', async () => {
    await expect(loginAction(loginForm('', ''))).rejects.toThrow('REDIRECT:/auth/login?error=missing');
    expect(mocks.rateLimit).not.toHaveBeenCalled();
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it('throttles before the user lookup and password hash', async () => {
    mocks.rateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 900 });

    await expect(loginAction(loginForm())).rejects.toThrow('REDIRECT:/auth/login?error=throttled');
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.verifyPassword).not.toHaveBeenCalled();
  });

  it('uses the same failure state for a missing user and bad password', async () => {
    mocks.userFindUnique.mockResolvedValue(null);
    await expect(loginAction(loginForm())).rejects.toThrow('REDIRECT:/auth/login?error=invalid');

    mocks.userFindUnique.mockResolvedValue({ id: 'user-1', passwordHash: 'hash', emailVerifiedAt: new Date() });
    mocks.verifyPassword.mockReturnValue(false);
    await expect(loginAction(loginForm())).rejects.toThrow('REDIRECT:/auth/login?error=invalid');
  });

  it('requires email verification before creating a session', async () => {
    mocks.userFindUnique.mockResolvedValue({ id: 'user-1', passwordHash: 'hash', emailVerifiedAt: null });

    await expect(loginAction(loginForm('OWNER@Example.Test')))
      .rejects.toThrow('REDIRECT:/auth/check-email?email=owner%40example.test&unverified=1');
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it('creates a session only after successful verification', async () => {
    mocks.userFindUnique.mockResolvedValue({ id: 'user-1', passwordHash: 'hash', emailVerifiedAt: new Date() });

    await expect(loginAction(loginForm())).rejects.toThrow('REDIRECT:/dashboard');
    expect(mocks.createSession).toHaveBeenCalledWith('user-1');
  });
});
