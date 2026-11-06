import { describe, expect, it } from 'vitest';
import {
  distanceMeters,
  stabilizePedestrianPosition,
  type PedestrianPositionFix
} from '@/lib/telemetry/pedestrianPositionFilter';

const origin = { latitude: 40.6852, longitude: -73.9418 };
const metersPerDegreeLatitude = 111_320;
const metersPerDegreeLongitude = metersPerDegreeLatitude * Math.cos(origin.latitude * Math.PI / 180);

function fix(eastMeters: number, northMeters: number, accuracyMeters: number, timestamp: number, speedMph = 0): PedestrianPositionFix {
  return {
    latitude: origin.latitude + northMeters / metersPerDegreeLatitude,
    longitude: origin.longitude + eastMeters / metersPerDegreeLongitude,
    accuracyMeters,
    timestamp,
    speedMph
  };
}

describe('stabilizePedestrianPosition', () => {
  it('rejects invalid coordinates and poor initial fixes', () => {
    expect(stabilizePedestrianPosition(null, fix(0, 0, 80, 1_000))).toBeNull();
    expect(stabilizePedestrianPosition(null, { ...fix(0, 0, 5, 1_000), latitude: 91 })).toBeNull();
    expect(stabilizePedestrianPosition(null, { ...fix(0, 0, 5, 1_000), longitude: Number.NaN })).toBeNull();
  });

  it('keeps stationary GPS jitter from adding walked distance', () => {
    let state = stabilizePedestrianPosition(null, fix(0, 0, 8, 1_000));
    expect(state).not.toBeNull();

    for (const [index, [east, north]] of [[1.2, -0.8], [-1.7, 1.1], [2.1, 0.6], [-2, -1.4], [0.9, 1.8], [-1.1, -1.9]].entries()) {
      state = stabilizePedestrianPosition(state, fix(east, north, 9 + (index % 3), 3_000 + index * 2_000));
    }

    expect(state).not.toBeNull();
    expect(distanceMeters(origin, state!)).toBeLessThanOrEqual(2.5);
    expect(state?.filteredDeltaMeters).toBe(0);
    expect(state?.held).toBe(true);
  });

  it('holds a poor or implausible fix without moving the visible position', () => {
    const initial = stabilizePedestrianPosition(null, fix(0, 0, 8, 1_000))!;
    const poorAccuracy = stabilizePedestrianPosition(initial, fix(60, 0, 70, 3_000))!;
    expect(poorAccuracy).toMatchObject({ latitude: initial.latitude, longitude: initial.longitude, held: true, filteredDeltaMeters: 0 });

    const jump = stabilizePedestrianPosition(initial, fix(500, 0, 5, 3_000))!;
    expect(jump).toMatchObject({ latitude: initial.latitude, longitude: initial.longitude, held: true, filteredDeltaMeters: 0 });
  });

  it('smooths real movement and resumes from a fresh fix after a long suspension', () => {
    const initial = stabilizePedestrianPosition(null, fix(0, 0, 5, 1_000, 2))!;
    const moved = stabilizePedestrianPosition(initial, fix(12, 0, 5, 6_000, 2))!;
    expect(moved.held).toBe(false);
    expect(moved.filteredDeltaMeters).toBeGreaterThan(0);
    expect(moved.filteredDeltaMeters).toBeLessThan(12);

    const resumed = stabilizePedestrianPosition(moved, fix(800, 0, 5, 6 * 60_000, 0))!;
    expect(resumed.held).toBe(false);
    expect(resumed.filteredDeltaMeters).toBe(0);
    expect(resumed.longitude).not.toBe(moved.longitude);
  });

  it('does not replace a fresh position with an out-of-order fix and handles the antimeridian', () => {
    const initial = stabilizePedestrianPosition(null, { latitude: 0, longitude: 179.99999, accuracyMeters: 4, timestamp: 10_000 })!;
    expect(stabilizePedestrianPosition(initial, { latitude: 0, longitude: 0, accuracyMeters: 4, timestamp: 9_000 })).toBe(initial);
    const crossed = stabilizePedestrianPosition(initial, { latitude: 0, longitude: -179.99999, accuracyMeters: 4, timestamp: 12_000, speedMph: 2 })!;
    expect(distanceMeters(initial, crossed)).toBeLessThan(5);
  });
});
