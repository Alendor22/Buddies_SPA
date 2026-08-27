import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAuthToken,
  encodeSession,
  hashPassword,
  normalizeEmail,
  sessionCookieOptions,
  slugify,
  verifyAuthToken,
  verifyPassword
} from '@/lib/auth';

describe('authentication primitives', () => {
  beforeEach(() => {
    vi.stubEnv('AUTH_SECRET', 'unit-test-auth-secret-at-least-32-characters');
  });

  it('normalizes identities and stable URL slugs', () => {
    expect(normalizeEmail('  Dog.Parent@Example.COM ')).toBe('dog.parent@example.com');
    expect(slugify('  Luna & Friends!  ')).toBe('luna-friends');
    expect(slugify('---')).toBe('');
    expect(slugify('a'.repeat(100))).toHaveLength(72);
  });

  it('hashes passwords with a unique salt and verifies safely', () => {
    const first = hashPassword('correct horse battery staple');
    const second = hashPassword('correct horse battery staple');

    expect(first).not.toBe(second);
    expect(verifyPassword('correct horse battery staple', first)).toBe(true);
    expect(verifyPassword('wrong password', first)).toBe(false);
    expect(verifyPassword('anything', 'not-a-valid-hash')).toBe(false);
    expect(verifyPassword('anything', null)).toBe(false);
  });

  it('signs purpose-bound tokens and rejects tampering', () => {
    const token = createAuthToken('user-1', 'OWNER@EXAMPLE.COM', 'verify-email');

    expect(verifyAuthToken(token, 'verify-email')).toMatchObject({
      userId: 'user-1',
      email: 'owner@example.com',
      purpose: 'verify-email'
    });
    expect(verifyAuthToken(token, 'reset-password')).toBeNull();

    const [payload, signature] = token.split('.');
    const tampered = payload.slice(0, -1) + (payload.endsWith('a') ? 'b' : 'a') + '.' + signature;
    expect(verifyAuthToken(tampered, 'verify-email')).toBeNull();
  });

  it('rejects expired tokens at the time boundary', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T12:00:00.000Z'));
    const token = createAuthToken('user-1', 'owner@example.com', 'reset-password');

    vi.setSystemTime(new Date('2026-08-27T12:30:01.000Z'));
    expect(verifyAuthToken(token, 'reset-password')).toBeNull();
  });

  it('creates opaque sessions and secure cookie defaults', () => {
    const session = encodeSession('user-1');
    expect(session).not.toContain('user-1');
    expect(sessionCookieOptions()).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 2_592_000,
      path: '/'
    });
  });
});
