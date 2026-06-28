import Ably from 'ably';

let client: Ably.Realtime | null = null;

export function getRealtimeClient() {
  if (typeof window === 'undefined') throw new Error('Realtime client is browser-only');
  client ??= new Ably.Realtime({ authUrl: '/api/realtime/token' });
  return client;
}

export const channels = {
  lostDog: (dogId: string) => `dog:${dogId}:lost`,
  walk: (walkId: string) => `walk:${walkId}`,
  messages: (walkId: string) => `walk:${walkId}:messages`,
  nearby: (geohash: string) => `nearby:${geohash}`
};
