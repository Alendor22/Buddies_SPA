export type PedestrianPositionFix = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  timestamp: number;
  speedMph?: number | null;
};

export type StabilizedPedestrianPosition = PedestrianPositionFix & {
  held: boolean;
  rawDeltaMeters: number;
  filteredDeltaMeters: number;
};

const EARTH_RADIUS_METERS = 6_371_000;
const INITIAL_ACCURACY_LIMIT_METERS = 60;
const TRACKING_ACCURACY_LIMIT_METERS = 40;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function distanceMeters(
  a: Pick<PedestrianPositionFix, 'latitude' | 'longitude'>,
  b: Pick<PedestrianPositionFix, 'latitude' | 'longitude'>
) {
  const lat1 = a.latitude * Math.PI / 180;
  const lat2 = b.latitude * Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * Math.PI / 180;
  const dLng = (b.longitude - a.longitude) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

function smoothingGain(accuracyMeters: number, speedMph: number) {
  const accuracyGain = accuracyMeters <= 8
    ? 0.58
    : accuracyMeters <= 15
      ? 0.46
      : accuracyMeters <= 25
        ? 0.32
        : 0.2;

  const movementBoost = speedMph >= 1 ? 0.12 : speedMph >= 0.5 ? 0.06 : 0;
  return clamp(accuracyGain + movementBoost, 0.18, 0.68);
}

function deadbandMeters(accuracyMeters: number, speedMph: number) {
  if (speedMph >= 1) return clamp(accuracyMeters * 0.08, 0.9, 2.2);
  if (speedMph >= 0.5) return clamp(accuracyMeters * 0.12, 1.4, 3.2);
  return clamp(accuracyMeters * 0.2, 2.5, 7);
}

export function stabilizePedestrianPosition(
  previous: StabilizedPedestrianPosition | null,
  next: PedestrianPositionFix
): StabilizedPedestrianPosition | null {
  if (!Number.isFinite(next.latitude) || !Number.isFinite(next.longitude)) return previous;

  const accuracyMeters = Math.max(0, next.accuracyMeters || 999);
  const speedMph = Math.max(0, next.speedMph ?? 0);

  if (!previous) {
    if (accuracyMeters > INITIAL_ACCURACY_LIMIT_METERS) return null;
    return {
      ...next,
      accuracyMeters,
      speedMph,
      held: false,
      rawDeltaMeters: 0,
      filteredDeltaMeters: 0
    };
  }

  const rawDeltaMeters = distanceMeters(previous, next);
  const dtSeconds = Math.max(0.1, (next.timestamp - previous.timestamp) / 1000);
  const maxPlausibleJumpMeters = Math.max(35, dtSeconds * 8 + accuracyMeters * 1.5);

  if (accuracyMeters > TRACKING_ACCURACY_LIMIT_METERS || rawDeltaMeters > maxPlausibleJumpMeters) {
    return {
      ...previous,
      accuracyMeters,
      timestamp: next.timestamp,
      speedMph,
      held: true,
      rawDeltaMeters,
      filteredDeltaMeters: 0
    };
  }

  const deadband = deadbandMeters(accuracyMeters, speedMph);
  if (rawDeltaMeters <= deadband) {
    return {
      ...previous,
      accuracyMeters,
      timestamp: next.timestamp,
      speedMph,
      held: true,
      rawDeltaMeters,
      filteredDeltaMeters: 0
    };
  }

  const baseGain = smoothingGain(accuracyMeters, speedMph);
  const distanceBoost = rawDeltaMeters >= deadband * 4 ? 0.12 : rawDeltaMeters >= deadband * 2 ? 0.06 : 0;
  const gain = clamp(baseGain + distanceBoost, 0.18, 0.74);
  const filtered = {
    latitude: previous.latitude + (next.latitude - previous.latitude) * gain,
    longitude: previous.longitude + (next.longitude - previous.longitude) * gain
  };
  const filteredDeltaMeters = distanceMeters(previous, filtered);

  return {
    ...next,
    latitude: filtered.latitude,
    longitude: filtered.longitude,
    accuracyMeters,
    speedMph,
    held: false,
    rawDeltaMeters,
    filteredDeltaMeters
  };
}
