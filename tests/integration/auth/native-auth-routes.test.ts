import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formRequest } from '../../support/next-request';

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    create: vi.fn()
  }
}));

vi.mock('@/lib/db', () => ({ prisma: prismaMock }));

import { hashPassword } from '@/lib/auth';
import { POST as login } from '@/app/api/auth/login/route';
import { POST as register } from '@/app/api/auth/register/route';

describe('native authentication route contracts', () => {
  beforeEach(() => {
    vi.stubEnv('AUTH_SECRET', 'integration-test-auth-secret-at-least-32-characters');
  });

  it('rejects incomplete registration without touching the database', async () => {
    const response = await register(formRequest('/api/auth/register', {
      displayName: 'Dog Parent',
      email: 'owner@example.com',
      password: 'short'
    }));

    expect(response.status).toBe(400);
    expect(await response.text()).toContain('Invalid account details');
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it('normalizes a new account and issues an HTTP-only session', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: 'user-1', displayName: 'Dog Parent' });

    const response = await register(formRequest('/api/auth/register', {
      displayName: 'Dog Parent',
      email: '  OWNER@Example.COM ',
      password: 'correct horse battery staple'
    }));

    expect(response.status).toBe(200);
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'owner@example.com' },
      select: { id: true }
    });
    expect(prismaMock.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        email: 'owner@example.com',
        displayName: 'Dog Parent',
        emailVerifiedAt: expect.any(Date),
        passwordHash: expect.stringMatching(/^pbkdf2_sha256\$/)
      })
    }));
    expect(response.headers.get('set-cookie')).toContain('buddies_session=');
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
  });

  it('returns a conflict for an existing account', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'existing-user' });

    const response = await register(formRequest('/api/auth/register', {
      displayName: 'Existing',
      email: 'existing@example.com',
      password: 'valid-password'
    }));

    expect(response.status).toBe(409);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it('does not reveal whether invalid login failed by email or password', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const missingUser = await login(formRequest('/api/auth/login', {
      email: 'missing@example.com',
      password: 'wrong-password'
    }));

    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      displayName: 'Dog Parent',
      passwordHash: hashPassword('correct-password')
    });
    const wrongPassword = await login(formRequest('/api/auth/login', {
      email: 'owner@example.com',
      password: 'wrong-password'
    }));

    expect(missingUser.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    expect(await missingUser.text()).toContain('Invalid credentials');
    expect(await wrongPassword.text()).toContain('Invalid credentials');
  });

  it('issues a session only after a valid password', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      displayName: 'Dog Parent',
      passwordHash: hashPassword('correct-password')
    });

    const response = await login(formRequest('/api/auth/login', {
      email: 'OWNER@example.com',
      password: 'correct-password'
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('buddies_session=');
    expect(await response.text()).toContain('Signed in');
  });
});
