import * as Ably from 'ably';
import { realtimeChannels } from '@/lib/realtimeChannels';

let client: Ably.Realtime | null = null;

export function getRealtimeClient() {
  if (typeof window === 'undefined') throw new Error('Realtime client is browser-only');
  client ??= new Ably.Realtime({ authUrl: '/api/realtime/token' });
  return client;
}

export const channels = realtimeChannels;
