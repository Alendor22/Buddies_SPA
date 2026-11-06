import { DogPresenceStatus } from '@/generated/prisma/client';

export type WalkingConfidenceInput = {
  explicitStart?: boolean;
  speedMph?: number | null;
  motionCadence?: boolean;
  knownRouteMatch?: boolean;
  scheduledWindow?: boolean;
  parkGeofence?: boolean;
  minutesSinceHeartbeat?: number;
};

export function neighborhoodKey(latitude: number, longitude: number) {
  return `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
}

export function walkingConfidence(input: WalkingConfidenceInput) {
  let score = 0;
  if (input.explicitStart) score += 40;
  if (typeof input.speedMph === 'number' && input.speedMph >= 1 && input.speedMph <= 4.5) score += 20;
  if (input.motionCadence) score += 15;
  if (input.knownRouteMatch) score += 15;
  if (input.scheduledWindow) score += 5;
  if (input.parkGeofence) score += 5;
  if (typeof input.speedMph === 'number' && input.speedMph > 8) score -= 45;
  if ((input.minutesSinceHeartbeat ?? 0) > 10) score -= 25;
  return Math.max(0, Math.min(100, score));
}

export function presenceStatusFromScore(score: number, speedMph?: number | null, minutesSinceHeartbeat = 0): DogPresenceStatus {
  if (typeof speedMph === 'number' && speedMph > 8) return DogPresenceStatus.POSSIBLY_DRIVING;
  if (minutesSinceHeartbeat > 20) return DogPresenceStatus.STALE;
  if (minutesSinceHeartbeat > 10) return DogPresenceStatus.PAUSED;
  if (score >= 75) return DogPresenceStatus.WALKING;
  if (score >= 45) return DogPresenceStatus.LIKELY_WALKING;
  return DogPresenceStatus.NOT_ACTIVE;
}

export function heatLevel(count: number) {
  if (count >= 12) return 'surge';
  if (count >= 6) return 'hot';
  if (count >= 3) return 'warm';
  if (count >= 1) return 'light';
  return 'none';
}
