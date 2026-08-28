import { cookies } from 'next/headers';
import { createHash, createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/db';

export const SESSION_COOKIE = 'buddies_session';
export const LOGOUT_COOKIE = 'buddies_signed_out';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const VERIFY_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24;
const RESET_TOKEN_MAX_AGE_SECONDS = 60 * 30;

export type CurrentUser = { id: string; email: string; displayName: string; role: string };
type AuthTokenPurpose = 'verify-email' | 'reset-password';
type AuthTokenPayload = { userId: string; email: string; purpose: AuthTokenPurpose; expiresAt: number };

export function normalizeEmail(email: string) { return email.trim().toLowerCase(); }

export function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '').slice(0, 72);
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 120_000, 32, 'sha256').toString('hex');
  return `pbkdf2_sha256$120000$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string | null | undefined) {
  if (!storedHash) return false;
  const [algorithm, iterationsRaw, salt, hash] = storedHash.split('$');
  if (algorithm !== 'pbkdf2_sha256' || !iterationsRaw || !salt || !hash) return false;
  const iterations = Number(iterationsRaw);
  if (!Number.isFinite(iterations)) return false;
  const candidate = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function authSecret() {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? 'dev-only-buddies-secret';
}

function signSession(userId: string) {
  return createHash('sha256').update(`${userId}.${authSecret()}`).digest('hex');
}

function signAuthPayload(encodedPayload: string) {
  return createHmac('sha256', authSecret()).update(encodedPayload).digest('base64url');
}

export function createAuthToken(userId: string, email: string, purpose: AuthTokenPurpose) {
  const maxAge = purpose === 'verify-email' ? VERIFY_TOKEN_MAX_AGE_SECONDS : RESET_TOKEN_MAX_AGE_SECONDS;
  const payload: AuthTokenPayload = { userId, email: normalizeEmail(email), purpose, expiresAt: Math.floor(Date.now() / 1000) + maxAge };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${signAuthPayload(encoded)}`;
}

export function verifyAuthToken(token: string, purpose: AuthTokenPurpose): AuthTokenPayload | null {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const expected = Buffer.from(signAuthPayload(encoded));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as AuthTokenPayload;
    if (!payload.userId || !payload.email || payload.purpose !== purpose || payload.expiresAt < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function encodeSession(userId: string) {
  return Buffer.from(JSON.stringify({ userId, signature: signSession(userId) })).toString('base64url');
}

function decodeSession(value: string | undefined) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as { userId?: string; signature?: string };
    if (!parsed.userId || !parsed.signature) return null;
    if (parsed.signature !== signSession(parsed.userId)) return null;
    return parsed.userId;
  } catch { return null; }
}

export function sessionCookieOptions() {
  return { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', maxAge: SESSION_MAX_AGE_SECONDS, path: '/' };
}

export async function createSession(userId: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, encodeSession(userId), sessionCookieOptions());
  store.set(LOGOUT_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 0, path: '/' });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.set(LOGOUT_COOKIE, '1', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 30, path: '/' });
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  if (store.get(LOGOUT_COOKIE)?.value === '1') return null;

  const userId = decodeSession(store.get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, displayName: true, role: true, emailVerifiedAt: true } });
  return user?.emailVerifiedAt ? { id: user.id, email: user.email, displayName: user.displayName, role: user.role.toString() } : null;
}

export async function requireCurrentUser() { const user = await getCurrentUser(); if (!user) throw new Error('Authentication required'); return user; }
