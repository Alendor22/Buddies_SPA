import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db';

// Tokens are high-entropy random secrets, not user-chosen passwords, so a fast
// cryptographic hash (not pbkdf2/bcrypt) is the right tool here — same approach GitHub
// and Stripe use for personal access tokens / API keys.
const TOKEN_PREFIX = 'bdy_pat_';
const TOKEN_BYTES = 32;
const MAX_ACTIVE_TOKENS_PER_USER = 20;

export class ApiTokenLimitError extends Error {
  constructor(message = 'You have reached the personal access token limit for this account') {
    super(message);
    this.name = 'ApiTokenLimitError';
  }
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function createPersonalAccessToken(userId: string, name: string) {
  const token = `${TOKEN_PREFIX}${randomBytes(TOKEN_BYTES).toString('base64url')}`;

  // A plain count-then-create is a check-then-act race: two concurrent requests can
  // both read a count under the limit before either commit, over-shooting it. An
  // advisory lock scoped to this user serializes the count+create per user without
  // needing SERIALIZABLE isolation (and its retry-on-conflict complexity) for what is
  // a soft per-account cap, not a security boundary.
  const record = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const activeCount = await tx.personalAccessToken.count({ where: { userId, revokedAt: null } });
    if (activeCount >= MAX_ACTIVE_TOKENS_PER_USER) throw new ApiTokenLimitError();
    return tx.personalAccessToken.create({
      data: { userId, name: name.trim().slice(0, 80), tokenHash: hashToken(token) },
      select: { id: true, name: true, createdAt: true }
    });
  });
  // The plaintext token is returned here only — it is never stored or logged again.
  return { ...record, token };
}

export function listPersonalAccessTokens(userId: string) {
  return prisma.personalAccessToken.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, createdAt: true, lastUsedAt: true, revokedAt: true }
  });
}

export async function revokePersonalAccessToken(userId: string, tokenId: string) {
  const result = await prisma.personalAccessToken.updateMany({
    where: { id: tokenId, userId, revokedAt: null },
    data: { revokedAt: new Date() }
  });
  return result.count > 0;
}

export async function authenticatePersonalAccessToken(token: string) {
  if (!token.startsWith(TOKEN_PREFIX)) return null;
  const record = await prisma.personalAccessToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, revokedAt: true, user: { select: { id: true, email: true, displayName: true, role: true } } }
  });
  if (!record || record.revokedAt) return null;

  // Best-effort: a failure here should never block the authenticated request itself.
  prisma.personalAccessToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);

  return record.user;
}
