import { redis } from '@/lib/redis';

const INDEX_KEY = 'buddies:checkins:active';
const KEY_PREFIX = 'buddies:checkin:';

export type ActiveCheckIn = {
  dogId: string;
  ownerId: string;
  placeName: string;
  latitude: number;
  longitude: number;
  note: string | null;
  checkedInAt: string;
  expiresAt: string;
};

function keyForDog(dogId: string) {
  return `${KEY_PREFIX}${dogId}`;
}

export function checkInsAvailable() {
  return Boolean(redis);
}

export async function saveCheckIn(record: ActiveCheckIn, ttlSeconds: number) {
  if (!redis) throw new Error('Redis is not configured.');
  await Promise.all([
    redis.set(keyForDog(record.dogId), record, { ex: ttlSeconds }),
    redis.sadd(INDEX_KEY, record.dogId)
  ]);
}

export async function removeCheckIn(dogId: string) {
  if (!redis) throw new Error('Redis is not configured.');
  await Promise.all([
    redis.del(keyForDog(dogId)),
    redis.srem(INDEX_KEY, dogId)
  ]);
}

export async function getCheckIn(dogId: string) {
  if (!redis) return null;
  return redis.get<ActiveCheckIn>(keyForDog(dogId));
}

export async function listActiveCheckIns() {
  if (!redis) return [] as ActiveCheckIn[];

  const members = await redis.smembers(INDEX_KEY) as string[];
  if (!members.length) return [] as ActiveCheckIn[];

  const records = await Promise.all(members.slice(0, 250).map((dogId) => redis.get<ActiveCheckIn>(keyForDog(dogId))));
  const staleIds: string[] = [];
  const now = Date.now();
  const active: ActiveCheckIn[] = [];

  records.forEach((record, index) => {
    if (!record || new Date(record.expiresAt).getTime() <= now) {
      staleIds.push(members[index]);
      return;
    }
    active.push(record);
  });

  if (staleIds.length) {
    await Promise.all(staleIds.map((dogId) => redis.srem(INDEX_KEY, dogId)));
  }

  return active;
}

export function distanceMiles(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const radius = 3958.8;
  const toRadians = (value: number) => value * Math.PI / 180;
  const latitudeDelta = toRadians(b.latitude - a.latitude);
  const longitudeDelta = toRadians(b.longitude - a.longitude);
  const latitudeA = toRadians(a.latitude);
  const latitudeB = toRadians(b.latitude);
  const h = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}
