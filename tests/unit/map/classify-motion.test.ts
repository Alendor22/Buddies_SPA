import { describe, expect, it } from 'vitest';
import { classifyMotion, type MotionSample } from '@/lib/telemetry/classifyMotion';

const sample = (overrides: Partial<MotionSample> = {}): MotionSample => ({
  speedMph: 0,
  accuracyMeters: 5,
  displacementMeters: 0,
  windowSeconds: 30,
  ...overrides
});

describe('classifyMotion', () => {
  it.each([
    ['poor GPS while walking', sample({ accuracyMeters: 101, priorClass: 'walking' }), 'paused', true, false],
    ['driving', sample({ speedMph: 8, displacementMeters: 150 }), 'possibly-driving', false, false],
    ['jogging', sample({ speedMph: 4.5, displacementMeters: 25, windowSeconds: 15 }), 'jogging', false, true],
    ['confident walk', sample({ speedMph: 2, displacementMeters: 250, windowSeconds: 150 }), 'walking', false, true],
    ['short movement', sample({ displacementMeters: 12 }), 'likely-walking', false, false],
    ['stationary', sample(), 'stationary', false, false]
  ])('%s', (_name, input, expectedClass, shouldPause, shouldStart) => {
    const result = classifyMotion(input);

    expect(result.motionClass).toBe(expectedClass);
    expect(result.shouldPauseWalk).toBe(shouldPause);
    expect(result.shouldStartWalk).toBe(shouldStart);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('pauses and eventually stops a prior walk', () => {
    expect(classifyMotion(sample({
      speedMph: 0.2,
      displacementMeters: 3,
      priorClass: 'walking',
      windowSeconds: 299
    }))).toMatchObject({ motionClass: 'paused', shouldPauseWalk: true, shouldStopWalk: false });

    expect(classifyMotion(sample({
      speedMph: 0.2,
      displacementMeters: 3,
      priorClass: 'walking',
      windowSeconds: 300
    }))).toMatchObject({ motionClass: 'paused', shouldPauseWalk: true, shouldStopWalk: true });
  });

  it('sanitizes null and negative sensor values', () => {
    expect(classifyMotion(sample({
      speedMph: -10,
      accuracyMeters: null,
      displacementMeters: -50,
      windowSeconds: -10
    }))).toMatchObject({ motionClass: 'stationary', shouldStartWalk: false });
  });
});
