import assert from 'node:assert/strict';
import {
  distanceMeters,
  stabilizePedestrianPosition
} from '../src/lib/telemetry/pedestrianPositionFilter.ts';

const origin = { latitude: 40.6852, longitude: -73.9418 };
const metersPerDegreeLat = 111_320;
const metersPerDegreeLng = metersPerDegreeLat * Math.cos(origin.latitude * Math.PI / 180);

function point(eastMeters, northMeters, accuracyMeters, timestamp, speedMph = 0) {
  return {
    latitude: origin.latitude + northMeters / metersPerDegreeLat,
    longitude: origin.longitude + eastMeters / metersPerDegreeLng,
    accuracyMeters,
    timestamp,
    speedMph
  };
}

assert.equal(
  stabilizePedestrianPosition(null, point(0, 0, 80, 1_000)),
  null,
  'an unusable initial fix must not initialize the visible position'
);

let state = stabilizePedestrianPosition(null, point(0, 0, 8, 1_000));
assert.ok(state, 'a good initial GPS fix should initialize tracking');

const jitter = [
  [1.2, -0.8],
  [-1.7, 1.1],
  [2.1, 0.6],
  [-2.0, -1.4],
  [0.9, 1.8],
  [-1.1, -1.9]
];

for (const [index, [east, north]] of jitter.entries()) {
  state = stabilizePedestrianPosition(
    state,
    point(east, north, 9 + (index % 3), 3_000 + index * 2_000, 0)
  );
  assert.ok(state, 'stationary jitter should retain a valid stabilized position');
}

const stationaryDriftMeters = distanceMeters(state, point(0, 0, 8, state.timestamp));
assert.ok(
  stationaryDriftMeters <= 2.5,
  `stationary GPS drift must remain within 2.5m, got ${stationaryDriftMeters.toFixed(2)}m`
);

const beforePoorFix = state;
state = stabilizePedestrianPosition(state, point(60, 0, 70, state.timestamp + 2_000, 0));
assert.ok(state, 'poor tracking fixes should hold the last good position rather than clear it');
assert.equal(state.held, true, 'poor-accuracy jump must be held');
assert.equal(state.filteredDeltaMeters, 0, 'poor-accuracy jump must not move the filtered position');
assert.ok(
  distanceMeters(beforePoorFix, state) <= 0.1,
  'poor-accuracy jump must not relocate the visible position'
);

for (let step = 1; step <= 5; step += 1) {
  state = stabilizePedestrianPosition(
    state,
    point(step * 5, 0, 5, state.timestamp + 2_000, 3)
  );
  assert.ok(state, 'good pedestrian movement should remain trackable');
  assert.equal(state.held, false, 'good walking movement should not remain in the stationary hold state');
}

const walkedMeters = distanceMeters(point(0, 0, 8, 1_000), state);
assert.ok(walkedMeters >= 18, `25m walking trace should advance at least 18m, got ${walkedMeters.toFixed(2)}m`);
assert.ok(walkedMeters <= 26, `filtered walking trace must not overshoot the 25m path, got ${walkedMeters.toFixed(2)}m`);

console.log(`PASS GPS stability: stationary drift ${stationaryDriftMeters.toFixed(2)}m; 25m walk resolved to ${walkedMeters.toFixed(2)}m.`);
