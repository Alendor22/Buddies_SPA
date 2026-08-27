export type PositionFilterState = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  timestamp: number;
};

export type PositionFilterInput = PositionFilterState & {
  speedMph?: number | null;
};

export type PositionFilterResult = {
  state: PositionFilterState;
  accepted: boolean;
  moved: boolean;
  deadbandMeters: number;
  rawDistanceMeters: number;
  filteredDistanceMeters: number;
  reason: 'initial' | 'stationary-deadband' | 'filtered' | 'poor-accuracy' | 'implausible-jump';
};

const EARTH_RADIUS_METERS = 6_371_000;
const HARD_ACCURACY_LIMIT_METERS = 45;
const INITIAL_ACCURACY_LIMIT_METERS = 65;
const MAX_PEDESTRIAN_JUMP_MPH = 14;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function distanceMeters(
  a: Pick<PositionFilterState, 'latitude' | 'longitude'>,
  b: Pick<PositionFilterState, 'latitude' | 'longitude'>
) {
  const lat1 = a.latitude * Math.PI / 180;
  const lat2 = b.latitude * Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * Math.PI / 180;
  const dLng = (b.longitude - a.longitude) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function pedestrianDeadbandMeters(accuracyMeters: number) {
  return clamp(Math.max(2.5, accuracyMeters * 0.22), 2.5, 8);
}

function smoothingFactor(accuracyMeters: number, rawDistanceMeters: number) {
  let factor = accuracyMeters <= 8
    ? 0.7
    : accuracyMeters <= 15
      ? 0.55
      : accuracyMeters <= 25
        ? 0.38
        : 0.22;

  if (rawDistanceMeters >= 60) factor = Math.max(factor, 0.85);
  else if (rawDistanceMeters >= 25) factor = Math.max(factor, 0.65);

  return factor;
}

export function filterPedestrianPosition(
  previous: PositionFilterState | null,
  input: PositionFilterInput
): PositionFilterResult {
  const accuracyMeters = Math.max(0, input.accuracyMeters || 999);
  const normalizedInput: PositionFilterState = {
    latitude: input.latitude,
    longitude: input.longitude,
    accuracyMeters,
    timestamp: input.timestamp
  };
  const deadbandMeters = pedestrianDeadbandMeters(accuracyMeters);

  if (!previous) {
    return {
      state: normalizedInput,
      accepted: accuracyMeters <= INITIAL_ACCURACY_LIMIT_METERS,
      moved: false,
      deadbandMeters,
      rawDistanceMeters: 0,
      filteredDistanceMeters: 0,
      reason: 'initial'
    };
  }

  const rawDistanceMeters = distanceMeters(previous, normalizedInput);

  if (accuracyMeters > HARD_ACCURACY_LIMIT_METERS) {
    return {
      state: previous,
      accepted: false,
      moved: false,
      deadbandMeters,
      rawDistanceMeters,
      filteredDistanceMeters: 0,
      reason: 'poor-accuracy'
    };
  }

  const dtSeconds = Math.max(0.25, (input.timestamp - previous.timestamp) / 1000);
  const impliedSpeedMph = (rawDistanceMeters / 1609.344) / (dtSeconds / 3600);
  const uncertaintyMeters = previous.accuracyMeters + accuracyMeters + 12;

  if (rawDistanceMeters > Math.max(30, uncertaintyMeters) && impliedSpeedMph > MAX_PEDESTRIAN_JUMP_MPH) {
    return {
      state: previous,
      accepted: false,
      moved: false,
      deadbandMeters,
      rawDistanceMeters,
      filteredDistanceMeters: 0,
      reason: 'implausible-jump'
    };
  }

  const reportedSpeedMph = Math.max(0, input.speedMph ?? 0);
  if (rawDistanceMeters <= deadbandMeters && reportedSpeedMph < 1.2) {
    return {
      state: {
        ...previous,
        accuracyMeters: Math.min(previous.accuracyMeters, accuracyMeters),
        timestamp: input.timestamp
      },
      accepted: true,
      moved: false,
      deadbandMeters,
      rawDistanceMeters,
      filteredDistanceMeters: 0,
      reason: 'stationary-deadband'
    };
  }

  const factor = smoothingFactor(accuracyMeters, rawDistanceMeters);
  const nextState: PositionFilterState = {
    latitude: previous.latitude + (input.latitude - previous.latitude) * factor,
    longitude: previous.longitude + (input.longitude - previous.longitude) * factor,
    accuracyMeters,
    timestamp: input.timestamp
  };
  const filteredDistanceMeters = distanceMeters(previous, nextState);

  return {
    state: nextState,
    accepted: true,
    moved: filteredDistanceMeters >= Math.max(1.5, deadbandMeters * 0.5),
    deadbandMeters,
    rawDistanceMeters,
    filteredDistanceMeters,
    reason: 'filtered'
  };
}
