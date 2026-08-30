import { Redis } from '@upstash/redis';

export type RedisClient = Pick<Redis, 'get' | 'set' | 'del' | 'incr' | 'expire' | 'ping'>;

let singleton: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (singleton !== undefined) return singleton;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  singleton = url && token ? new Redis({ url, token }) : null;
  return singleton;
}

export function resetRedisForTests() { singleton = undefined; }
