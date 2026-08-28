import { redis } from '@/lib/redis';

// Fixed-window limiter backed by Upstash. Redis was already provisioned but unused.
//
// Two deliberate choices:
//  - Fails OPEN when Redis is unavailable. A limiter outage should not take down login.
//    The tradeoff is accepted because this is a throttle, not an authorization control.
//  - Keys are hashed so raw email addresses are never written to Redis.
export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

const ALLOW = (limit: number): RateLimitResult => ({
  allowed: true,
  remaining: limit,
  retryAfterSeconds: 0
});

async function hashKey(value: string) {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

export async function rateLimit(
  scope: string,
  identifier: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  if (!redis) return ALLOW(limit);

  try {
    const bucket = Math.floor(Date.now() / 1000 / windowSeconds);
    const key = `rl:${scope}:${await hashKey(identifier)}:${bucket}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSeconds);

    if (count > limit) {
      return { allowed: false, remaining: 0, retryAfterSeconds: windowSeconds };
    }
    return { allowed: true, remaining: Math.max(0, limit - count), retryAfterSeconds: 0 };
  } catch {
    return ALLOW(limit);
  }
}

// Best-effort client address. Vercel always sets x-forwarded-for at the edge; the
// leftmost entry is the client. Falls back to a constant so a missing header degrades
// to a global bucket rather than skipping the limit entirely.
export function clientIdentifier(headerValue: string | null | undefined) {
  const forwarded = headerValue?.split(',')[0]?.trim();
  return forwarded && forwarded.length > 0 ? forwarded : 'unknown-client';
}
