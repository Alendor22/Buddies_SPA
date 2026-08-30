import { getRedis } from './client';
export async function redisHealth() {
  const redis = getRedis();
  if (!redis) return { configured: false, healthy: true, mode: 'disabled' as const };
  try { const pong = await redis.ping(); return { configured: true, healthy: pong === 'PONG', mode: 'upstash' as const }; }
  catch (error) { return { configured: true, healthy: false, mode: 'upstash' as const, error: error instanceof Error ? error.message : 'Redis health check failed' }; }
}
