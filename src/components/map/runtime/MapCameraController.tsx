'use client';

import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-map-gl/mapbox';
import { useMapRuntimeStore, type MapCameraMode } from '@/stores/useMapRuntimeStore';

type OrientationEventWithWebkitHeading = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};

type WindowWithLegacyOrientation = Window & {
  orientation?: number;
};

function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

function shortestAngularDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180;
}

function smoothHeading(previous: number, next: number, factor = 0.22) {
  return normalizeDegrees(previous + shortestAngularDelta(previous, next) * factor);
}

function getScreenRotation() {
  const modern = window.screen.orientation?.angle;
  if (typeof modern === 'number') return modern;
  const legacy = (window as WindowWithLegacyOrientation).orientation;
  return typeof legacy === 'number' ? legacy : 0;
}

export default function MapCameraController() {
  const maps = useMap();
  const cameraMode = useMapRuntimeStore((state) => state.cameraMode);
  const followZoom = useMapRuntimeStore((state) => state.followZoom);
  const followPitch = useMapRuntimeStore((state) => state.followPitch);
  const bearing = useMapRuntimeStore((state) => state.bearing);
  const telemetry = useMapRuntimeStore((state) => state.telemetry);
  const setArOrientation = useMapRuntimeStore((state) => state.setArOrientation);
  const setCameraMode = useMapRuntimeStore((state) => state.setCameraMode);
  const [hasDeviceHeading, setHasDeviceHeading] = useState(false);
  const smoothedHeadingRef = useRef<number | null>(null);

  useEffect(() => {
    function handleMode(event: Event) {
      const nextMode = (event as CustomEvent<MapCameraMode>).detail;
      if (nextMode) setCameraMode(nextMode);
    }

    window.addEventListener('buddies:map-camera-mode', handleMode);
    return () => window.removeEventListener('buddies:map-camera-mode', handleMode);
  }, [setCameraMode]);

  useEffect(() => {
    if (cameraMode !== 'ar') {
      smoothedHeadingRef.current = null;
      setHasDeviceHeading(false);
      return;
    }

    function handleOrientation(event: DeviceOrientationEvent) {
      const oriented = event as OrientationEventWithWebkitHeading;
      const rawHeading = typeof oriented.webkitCompassHeading === 'number'
        ? oriented.webkitCompassHeading
        : typeof event.alpha === 'number'
          ? normalizeDegrees(360 - event.alpha + getScreenRotation())
          : null;

      if (rawHeading == null || !Number.isFinite(rawHeading)) return;

      const previous = smoothedHeadingRef.current;
      const heading = previous == null ? normalizeDegrees(rawHeading) : smoothHeading(previous, rawHeading);
      smoothedHeadingRef.current = heading;
      setHasDeviceHeading(true);
      setArOrientation({
        heading,
        pitch: typeof event.beta === 'number' ? event.beta : null,
        roll: typeof event.gamma === 'number' ? event.gamma : null
      });
    }

    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => window.removeEventListener('deviceorientation', handleOrientation, true);
  }, [cameraMode, setArOrientation]);

  useEffect(() => {
    const map = maps.current;
    if (!map) return;

    const currentCenter = map.getCenter();
    const hasDevicePosition = telemetry.latitude != null && telemetry.longitude != null;
    const center: [number, number] = hasDevicePosition
      ? [telemetry.longitude as number, telemetry.latitude as number]
      : [currentCenter.lng, currentCenter.lat];

    if (cameraMode === 'ar') {
      const arBearing = hasDeviceHeading
        ? bearing
        : telemetry.heading ?? bearing ?? map.getBearing();

      map.easeTo({
        center,
        zoom: Math.max(19.2, followZoom),
        pitch: 80,
        bearing: arBearing,
        offset: [0, 185],
        duration: hasDeviceHeading ? 140 : 500,
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
  }, [bearing, cameraMode, followPitch, followZoom, hasDeviceHeading, maps, telemetry.heading, telemetry.latitude, telemetry.longitude]);

  return null;
}
