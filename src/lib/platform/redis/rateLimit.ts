import type { RedisClient } from './client';
import { redisKeys } from './keys';
export async function fixedWindowRateLimit(redis: RedisClient | null, input: { scope: string; subject: string; limit: number; windowSeconds: number }) {
  if (!redis) return { allowed: true, remaining: input.limit, resetSeconds: input.windowSeconds, degraded: true };
  const key = redisKeys.rateLimit(input.scope, input.subject);
  try { const count = await redis.incr(key); if (count === 1) await redis.expire(key, input.windowSeconds); return { allowed: count <= input.limit, remaining: Math.max(0, input.limit - count), resetSeconds: input.windowSeconds, degraded: false }; }
  catch { return { allowed: true, remaining: input.limit, resetSeconds: input.windowSeconds, degraded: true }; }
}
