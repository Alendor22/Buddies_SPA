import type { RedisClient } from './client';

export async function cached<T>(redis: RedisClient | null, key: string, ttlSeconds: number, loader: () => Promise<T>) {
  if (redis) { try { const hit = await redis.get<T>(key); if (hit !== null && hit !== undefined) return { value: hit, source: 'redis' as const }; } catch {} }
  const value = await loader();
  if (redis) { try { await redis.set(key, value, { ex: ttlSeconds }); } catch {} }
  return { value, source: 'origin' as const };
}

export async function invalidate(redis: RedisClient | null, ...keys: string[]) {
  if (!redis || keys.length === 0) return;
  try { await redis.del(...keys); } catch {}
}
