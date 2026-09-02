import { auth, currentUser as currentClerkUser } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';
import { cache } from 'react';
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
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (secret) return secret;
  // Falling back to a hardcoded default in production would let anyone who can read this
  // repository forge a session for any user id. Fail closed instead.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET is not configured; refusing to sign sessions with a default secret.');
  }
  return 'dev-only-buddies-secret';
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

export type SessionPayload = { userId: string; version: number; expiresAt: number };

export function encodeSession(userId: string, version = 0) {
  const payload: SessionPayload = {
    userId,
    version,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${signAuthPayload(encoded)}`;
}

// Verifies the signature and expiry only. The caller must still compare `version`
// against the user's current sessionVersion -- that comparison is what makes
// server-side revocation possible.
function decodeSession(value: string | undefined): SessionPayload | null {
  if (!value) return null;
  const [encoded, signature] = value.split('.');
  if (!encoded || !signature) return null;

  const expected = Buffer.from(signAuthPayload(encoded));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.userId || typeof payload.version !== 'number') return null;
    if (!payload.expiresAt || payload.expiresAt < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', maxAge: SESSION_MAX_AGE_SECONDS, path: '/' };
}

export async function createSession(userId: string) {
  const store = await cookies();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { sessionVersion: true } });
  store.set(SESSION_COOKIE, encodeSession(userId, user?.sessionVersion ?? 0), sessionCookieOptions());
  store.set(LOGOUT_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 0, path: '/' });
}

export async function clearSession() {
  const store = await cookies();
  // Bump the stored version so every copy of the old cookie stops working, not just
  // the one in this browser.
  const existing = decodeSession(store.get(SESSION_COOKIE)?.value);
  if (existing) {
    await prisma.user
      .update({ where: { id: existing.userId }, data: { sessionVersion: { increment: 1 } } })
      .catch(() => undefined);
  }
  store.delete(SESSION_COOKIE);
  store.set(LOGOUT_COOKIE, '1', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 30, path: '/' });
}

async function resolveCurrentUser(): Promise<CurrentUser | null> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  const linked = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, email: true, displayName: true, role: true }
  });
  if (linked) {
    return { ...linked, role: linked.role.toString() };
  }

  const clerkUser = await currentClerkUser();
  if (!clerkUser) return null;

  const primaryAddress = clerkUser.emailAddresses.find(
    (address) => address.id === clerkUser.primaryEmailAddressId
  );
  const primaryEmail = primaryAddress?.emailAddress;
  if (!primaryEmail) return null;

  // Whether Clerk has actually proven the user controls this address. Password sign-up
  // always verifies, but an OAuth provider can hand back an address it never checked.
  const emailIsVerified = primaryAddress?.verification?.status === 'verified';

  const email = normalizeEmail(primaryEmail);
  const displayName =
    clerkUser.fullName?.trim() ||
    clerkUser.username?.trim() ||
    email.split('@')[0] ||
    'Buddies User';

  const user = await prisma.$transaction(async (tx) => {
    const existingByClerk = await tx.user.findUnique({ where: { clerkId } });
    if (existingByClerk) return existingByClerk;

    const existingByEmail = await tx.user.findUnique({ where: { email } });
    if (existingByEmail) {
      // Adopting an existing account on an email match is the account-takeover path:
      // sign up through a provider that does not verify addresses, claim someone
      // else's email, and this attaches the new Clerk identity to their dogs, walks
      // and messages. Only ever link on a verified address.
      if (!emailIsVerified) return null;

      return tx.user.update({
        where: { id: existingByEmail.id },
        data: {
          clerkId,
          displayName: existingByEmail.displayName || displayName,
          emailVerifiedAt: existingByEmail.emailVerifiedAt ?? new Date(),
          avatarUrl: existingByEmail.avatarUrl ?? clerkUser.imageUrl
        }
      });
    }

    return tx.user.create({
      data: {
        clerkId,
        email,
        displayName,
        // Do not assert verification the identity provider never performed.
        emailVerifiedAt: emailIsVerified ? new Date() : null,
        avatarUrl: clerkUser.imageUrl
      }
    });
  });

  if (!user) {
    console.warn('Refused to link a Clerk identity to an existing account: primary email is unverified.', { clerkId });
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role.toString()
  };
}

// Memoized for the lifetime of a single server request. A route handler that calls
// getCurrentUser() and then renders components that call it again was paying a
// Postgres round trip each time, and at production latency that lookup dominates
// the request. React's cache() is request-scoped, so this shares nothing between
// users or between requests.
export const getCurrentUser = cache(resolveCurrentUser);

export async function requireCurrentUser() { const user = await getCurrentUser(); if (!user) throw new Error('Authentication required'); return user; }
