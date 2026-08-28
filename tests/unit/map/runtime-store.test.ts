import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMapRuntimeStore } from '@/stores/useMapRuntimeStore';

describe('useMapRuntimeStore', () => {
  beforeEach(() => {
    useMapRuntimeStore.setState(useMapRuntimeStore.getInitialState(), true);
  });

  it('normalizes camera and AR headings', () => {
    useMapRuntimeStore.getState().setBearing(-10);
    expect(useMapRuntimeStore.getState().bearing).toBe(350);

    useMapRuntimeStore.getState().setArOrientation({ heading: 721, pitch: 12, roll: -4 });
    expect(useMapRuntimeStore.getState()).toMatchObject({
      bearing: 1,
      arDevicePitch: 12,
      arDeviceRoll: -4
    });

    useMapRuntimeStore.getState().patchArTracking({ heading: -1 });
    expect(useMapRuntimeStore.getState().arTracking.heading).toBe(359);
  });

  it('clamps user-controlled AR values', () => {
    useMapRuntimeStore.getState().setArOverlayOpacity(5);
    useMapRuntimeStore.getState().setArFieldOfViewDegrees(1);
    expect(useMapRuntimeStore.getState()).toMatchObject({
      arOverlayOpacity: 0.85,
      arFieldOfViewDegrees: 45
    });

    useMapRuntimeStore.getState().setArOverlayOpacity(0);
    useMapRuntimeStore.getState().setArFieldOfViewDegrees(200);
    expect(useMapRuntimeStore.getState()).toMatchObject({
      arOverlayOpacity: 0.15,
      arFieldOfViewDegrees: 100
    });
  });

  it('updates layers without mutating unrelated visibility', () => {
    const waterBefore = useMapRuntimeStore.getState().layers.water;
    useMapRuntimeStore.getState().toggleLayer('hazards');
    useMapRuntimeStore.getState().setLayerVisible('reports', false);

    expect(useMapRuntimeStore.getState().layers.hazards).toBe(false);
    expect(useMapRuntimeStore.getState().layers.reports).toBe(false);
    expect(useMapRuntimeStore.getState().layers.water).toBe(waterBefore);
  });

  it('runs the walk lifecycle from current telemetry', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T12:00:00.000Z'));

    useMapRuntimeStore.getState().patchTelemetry({ latitude: 40.1, longitude: -73.9, distanceMiles: 1.25 });
    useMapRuntimeStore.getState().startWalk({ id: 'walk-1', autoDetected: true });

    expect(useMapRuntimeStore.getState()).toMatchObject({
      uiMode: 'walking',
      activeWalk: {
        id: 'walk-1',
        autoDetected: true,
        startedAt: '2026-08-27T12:00:00.000Z',
        startLatitude: 40.1,
        startLongitude: -73.9
      }
    });

    useMapRuntimeStore.getState().pauseWalk();
    expect(useMapRuntimeStore.getState().activeWalk.pausedAt).toBe('2026-08-27T12:00:00.000Z');

    useMapRuntimeStore.getState().endWalk();
    expect(useMapRuntimeStore.getState().uiMode).toBe('normal');
    expect(useMapRuntimeStore.getState().activeWalk.id).toBeNull();
  });

  it('resets telemetry and AR tracking independently', () => {
    useMapRuntimeStore.getState().patchTelemetry({ distanceMiles: 5, motionClass: 'walking' });
    useMapRuntimeStore.getState().patchArTracking({ source: 'webxr-slam', state: 'tracking', xMeters: 4 });

    useMapRuntimeStore.getState().resetTelemetry();
    expect(useMapRuntimeStore.getState().telemetry).toMatchObject({ distanceMiles: 0, motionClass: 'stationary' });
    expect(useMapRuntimeStore.getState().arTracking.state).toBe('tracking');

    useMapRuntimeStore.getState().resetArTracking();
    expect(useMapRuntimeStore.getState().arTracking).toMatchObject({ source: 'none', state: 'idle', xMeters: 0 });
  });
});
