import assert from 'node:assert/strict';
import {
  distanceMeters,
  filterPedestrianPosition
} from '../src/lib/telemetry/filterPosition.ts';

const origin = { latitude: 40.6852, longitude: -73.9418 };
const metersPerDegreeLat = 111_320;
const metersPerDegreeLng = metersPerDegreeLat * Math.cos(origin.latitude * Math.PI / 180);

function offsetPoint(eastMeters, northMeters, accuracyMeters, timestamp, speedMph = 0) {
  return {
    latitude: origin.latitude + northMeters / metersPerDegreeLat,
    longitude: origin.longitude + eastMeters / metersPerDegreeLng,
    accuracyMeters,
    timestamp,
    speedMph
  };
}

let state = null;
let result = filterPedestrianPosition(state, offsetPoint(0, 0, 8, 1_000));
assert.equal(result.accepted, true, 'initial good GPS fix should be accepted');
state = result.state;

const stationaryJitter = [
  [1.2, -0.8],
  [-1.7, 1.1],
  [2.1, 0.6],
  [-2.0, -1.4],
  [0.9, 1.8],
  [-1.1, -1.9]
];

for (const [index, [east, north]] of stationaryJitter.entries()) {
  result = filterPedestrianPosition(state, offsetPoint(east, north, 9 + (index % 3), 3_000 + index * 2_000, 0));
  assert.equal(result.accepted, true, 'normal stationary jitter should remain a valid fix');
  state = result.state;
}

const stationaryDriftMeters = distanceMeters(state, offsetPoint(0, 0, 8, state.timestamp));
assert.ok(stationaryDriftMeters <= 2.5, `stationary filtered drift must stay within 2.5m, got ${stationaryDriftMeters.toFixed(2)}m`);

result = filterPedestrianPosition(state, offsetPoint(60, 0, 70, state.timestamp + 2_000, 0));
assert.equal(result.accepted, false, 'poor-accuracy 60m jump must be rejected');
assert.equal(result.reason, 'poor-accuracy');

for (let step = 1; step <= 5; step += 1) {
  result = filterPedestrianPosition(state, offsetPoint(step * 5, 0, 5, state.timestamp + 2_000, 3));
  assert.equal(result.accepted, true, 'good-accuracy pedestrian movement should be accepted');
  state = result.state;
}

const walkedMeters = distanceMeters(offsetPoint(0, 0, 8, 1_000), state);
assert.ok(walkedMeters >= 14, `real walking movement must advance the filtered position, got ${walkedMeters.toFixed(2)}m`);
assert.ok(walkedMeters <= 26, `filtered walking position should not overshoot the 25m path, got ${walkedMeters.toFixed(2)}m`);

console.log(`PASS GPS stability: stationary drift ${stationaryDriftMeters.toFixed(2)}m; 25m walk resolved to ${walkedMeters.toFixed(2)}m.`);
