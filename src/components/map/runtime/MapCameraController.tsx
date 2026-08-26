'use client';

import { useEffect } from 'react';
import { useMap } from 'react-map-gl/mapbox';
import { useMapRuntimeStore, type MapCameraMode } from '@/stores/useMapRuntimeStore';

type OrientationEventWithWebkitHeading = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};

export default function MapCameraController() {
  const maps = useMap();
  const cameraMode = useMapRuntimeStore((state) => state.cameraMode);
  const followZoom = useMapRuntimeStore((state) => state.followZoom);
  const followPitch = useMapRuntimeStore((state) => state.followPitch);
  const bearing = useMapRuntimeStore((state) => state.bearing);
  const telemetry = useMapRuntimeStore((state) => state.telemetry);
  const setBearing = useMapRuntimeStore((state) => state.setBearing);
  const setCameraMode = useMapRuntimeStore((state) => state.setCameraMode);

  useEffect(() => {
    function handleMode(event: Event) {
      const nextMode = (event as CustomEvent<MapCameraMode>).detail;
      if (nextMode) setCameraMode(nextMode);
    }

    window.addEventListener('buddies:map-camera-mode', handleMode);
    return () => window.removeEventListener('buddies:map-camera-mode', handleMode);
  }, [setCameraMode]);

  useEffect(() => {
    if (cameraMode !== 'ar') return;

    function handleOrientation(event: DeviceOrientationEvent) {
      const oriented = event as OrientationEventWithWebkitHeading;
      const heading = typeof oriented.webkitCompassHeading === 'number'
        ? oriented.webkitCompassHeading
        : typeof event.alpha === 'number'
          ? 360 - event.alpha
          : null;

      if (heading != null && Number.isFinite(heading)) setBearing(heading);
    }

    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => window.removeEventListener('deviceorientation', handleOrientation, true);
  }, [cameraMode, setBearing]);

  useEffect(() => {
    const map = maps.current;
    if (!map) return;

    const currentCenter = map.getCenter();
    const hasDevicePosition = telemetry.latitude != null && telemetry.longitude != null;
    const center: [number, number] = hasDevicePosition
      ? [telemetry.longitude as number, telemetry.latitude as number]
      : [currentCenter.lng, currentCenter.lat];

    if (cameraMode === 'ar') {
      map.easeTo({
        center,
        zoom: Math.max(19.2, followZoom),
        pitch: 80,
        bearing: telemetry.heading ?? bearing ?? map.getBearing(),
        offset: [0, 185],
        duration: 700,
        essential: true
      });
      return;
    }

    if (cameraMode === 'follow') {
      map.easeTo({
        center,
        zoom: followZoom,
        pitch: followPitch,
        bearing: telemetry.heading ?? bearing,
        offset: [0, 130],
        duration: 500,
        essential: true
      });
      return;
    }

    if (cameraMode === 'overview') {
      map.easeTo({
        center,
        zoom: 14.5,
        pitch: 30,
        bearing: 0,
        offset: [0, 0],
        duration: 650,
        essential: true
      });
    }
  }, [bearing, cameraMode, followPitch, followZoom, maps, telemetry.heading, telemetry.latitude, telemetry.longitude]);

  return null;
}
