import { describe, expect, it } from 'vitest';
import {
  geodeticFromLocalPose,
  immersiveArSessionOptions,
  normalizeLongitude,
  trackingSourceForNative,
  trackingSourceForWebXr
} from '@/components/map/runtime/xrSlam';

const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };

describe('XR SLAM runtime', () => {
  it('selects ARCore WebXR for Android and keeps native bridge sources explicit', () => {
    expect(trackingSourceForWebXr('Mozilla/5.0 Android 16 Chrome/151')).toBe('arcore-webxr');
    expect(trackingSourceForWebXr('Mozilla/5.0 iPhone')).toBe('webxr-slam');
    expect(trackingSourceForNative('arkit')).toBe('arkit-native');
    expect(trackingSourceForNative('arcore')).toBe('arcore-native');
  });

  it('requests progressive real-world surface capabilities', () => {
    const root = {} as Element;
    const options = immersiveArSessionOptions(root);

    expect(options.requiredFeatures).toContain('local');
    expect(options.optionalFeatures).toEqual(expect.arrayContaining(['dom-overlay', 'hit-test', 'anchors']));
    expect(options.domOverlay.root).toBe(root);
  });

  it('converts forward and lateral SLAM displacement into geographic motion', () => {
    const calibration = {
      latitude: 40.7357,
      longitude: -74.1724,
      heading: 0,
      x: 0,
      y: 0,
      z: 0,
      yaw: 0
    };

    const east = geodeticFromLocalPose(calibration, { x: 10, y: 0, z: 0 }, IDENTITY);
    const north = geodeticFromLocalPose(calibration, { x: 0, y: 0, z: -10 }, IDENTITY);

    expect(east.longitude).toBeGreaterThan(calibration.longitude);
    expect(Math.abs(east.latitude - calibration.latitude)).toBeLessThan(0.000001);
    expect(north.latitude).toBeGreaterThan(calibration.latitude);
  });

  it('keeps longitude normalized across the international date line', () => {
    expect(normalizeLongitude(180.2)).toBeCloseTo(-179.8, 8);
    expect(normalizeLongitude(-180.2)).toBeCloseTo(179.8, 8);
  });
});
