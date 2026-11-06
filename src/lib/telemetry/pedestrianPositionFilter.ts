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
const RESYNC_AFTER_MS = 5 * 60 * 1000;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function validCoordinates(latitude: number, longitude: number) {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
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
  if (!validCoordinates(next.latitude, next.longitude) || !Number.isFinite(next.timestamp) || next.timestamp <= 0) {
    return previous;
  }

  const accuracyMeters = Number.isFinite(next.accuracyMeters) && next.accuracyMeters >= 0
    ? next.accuracyMeters
    : Number.POSITIVE_INFINITY;
  const speedMph = Number.isFinite(next.speedMph) && (next.speedMph ?? -1) >= 0
    ? next.speedMph as number
    : 0;

  if (!previous) {
    if (accuracyMeters > INITIAL_ACCURACY_LIMIT_METERS) return null;
    return { ...next, accuracyMeters, speedMph, held: false, rawDeltaMeters: 0, filteredDeltaMeters: 0 };
  }

  if (next.timestamp <= previous.timestamp) return previous;

  const dtSeconds = (next.timestamp - previous.timestamp) / 1000;
  const rawDeltaMeters = distanceMeters(previous, next);

  // After a long suspension, accept a fresh accurate fix as a new baseline. This
  // restores the visible position without counting the gap as walked distance.
  if (dtSeconds * 1000 >= RESYNC_AFTER_MS && accuracyMeters <= INITIAL_ACCURACY_LIMIT_METERS) {
    return { ...next, accuracyMeters, speedMph, held: false, rawDeltaMeters, filteredDeltaMeters: 0 };
  }

  const plausibleJumpMeters = Math.max(35, Math.min(250, dtSeconds * 8 + accuracyMeters * 1.5));
  if (accuracyMeters > TRACKING_ACCURACY_LIMIT_METERS || rawDeltaMeters > plausibleJumpMeters) {
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

  const gain = clamp(smoothingGain(accuracyMeters, speedMph) + (rawDeltaMeters >= deadband * 4 ? 0.12 : rawDeltaMeters >= deadband * 2 ? 0.06 : 0), 0.18, 0.74);
  // Interpolate across the antimeridian using the short longitude arc.
  const longitudeDelta = ((next.longitude - previous.longitude + 540) % 360) - 180;
  const filtered = {
    latitude: previous.latitude + (next.latitude - previous.latitude) * gain,
    longitude: ((previous.longitude + longitudeDelta * gain + 540) % 360) - 180
  };
  const filteredDeltaMeters = distanceMeters(previous, filtered);

  return {
    ...next,
    ...filtered,
    accuracyMeters,
    speedMph,
    held: false,
    rawDeltaMeters,
    filteredDeltaMeters
  };
}
