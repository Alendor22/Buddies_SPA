import { beforeEach, describe, expect, it, vi } from 'vitest';

const clerkMock = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn()
}));

const cookieStore = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn()
}));
const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn()
  }
}));

vi.mock('@clerk/nextjs/server', () => clerkMock);
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock('@/lib/db', () => ({ prisma: prismaMock }));

import {
  clearSession,
  createAuthToken,
  createSession,
  encodeSession,
  getCurrentUser,
  hashPassword,
  LOGOUT_COOKIE,
  normalizeEmail,
  requireCurrentUser,
  SESSION_COOKIE,
  sessionCookieOptions,
  slugify,
  verifyAuthToken,
  verifyPassword
} from '@/lib/auth';

describe('authentication primitives', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clerkMock.auth.mockResolvedValue({ userId: null });
    clerkMock.currentUser.mockResolvedValue(null);
    vi.stubEnv('AUTH_SECRET', 'unit-test-auth-secret-at-least-32-characters');
    cookieStore.get.mockReturnValue(undefined);
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

  it('creates a versioned session and clears the logout marker', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ sessionVersion: 4 });

    await createSession('user-1');

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { sessionVersion: true }
    });
    expect(cookieStore.set).toHaveBeenCalledWith(
      SESSION_COOKIE,
      expect.any(String),
      expect.objectContaining({ httpOnly: true })
    );
    expect(cookieStore.set).toHaveBeenCalledWith(
      LOGOUT_COOKIE,
      '',
      expect.objectContaining({ maxAge: 0 })
    );
  });

  it('revokes the stored session version when signing out', async () => {
    cookieStore.get.mockImplementation((name: string) => name === SESSION_COOKIE
      ? { value: encodeSession('user-1', 2) }
      : undefined);
    prismaMock.user.update.mockResolvedValue({ id: 'user-1' });

    await clearSession();

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { sessionVersion: { increment: 1 } }
    });
    expect(cookieStore.delete).toHaveBeenCalledWith(SESSION_COOKIE);
    expect(cookieStore.set).toHaveBeenCalledWith(
      LOGOUT_COOKIE,
      '1',
      expect.objectContaining({ maxAge: 2_592_000 })
    );
  });

  it('resolves the Buddies user linked to the active Clerk identity', async () => {
    clerkMock.auth.mockResolvedValue({ userId: 'clerk-user-1' });
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.test',
      displayName: 'Dog Parent',
      role: 'OWNER'
    });

    await expect(getCurrentUser()).resolves.toEqual({
      id: 'user-1',
      email: 'owner@example.test',
      displayName: 'Dog Parent',
      role: 'OWNER'
    });
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { clerkId: 'clerk-user-1' },
      select: { id: true, email: true, displayName: true, role: true }
    });
  });

  it('treats a missing Clerk session as signed out without querying the database', async () => {
    await expect(getCurrentUser()).resolves.toBeNull();
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('fails closed when an authenticated user is required', async () => {
    await expect(requireCurrentUser()).rejects.toThrow('Authentication required');
  });

  it('still clears local cookies when server-side revocation fails', async () => {
    cookieStore.get.mockImplementation((name: string) => name === SESSION_COOKIE
      ? { value: encodeSession('missing-user', 1) }
      : undefined);
    prismaMock.user.update.mockRejectedValue(new Error('user already removed'));

    await expect(clearSession()).resolves.toBeUndefined();
    expect(cookieStore.delete).toHaveBeenCalledWith(SESSION_COOKIE);
  });
});
