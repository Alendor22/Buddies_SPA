'use client';

import { useEffect, useRef } from 'react';
import { useMap } from 'react-map-gl/mapbox';
import { useMapRuntimeStore, type MapCameraMode, type MotionClass } from '@/stores/useMapRuntimeStore';

type OrientationEventWithWebkitHeading = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};

type WindowWithLegacyOrientation = Window & {
  orientation?: number;
};

type Coordinate = {
  latitude: number;
  longitude: number;
};

type StationaryCandidate = Coordinate & {
  count: number;
};

const AR_REFERENCE_FOV_DEGREES = 68;
const AR_MIN_ZOOM = 18.2;
const AR_MAX_ZOOM = 21;
const HEADING_DEADBAND_DEGREES = 1.25;
const CAMERA_BEARING_EPSILON_DEGREES = 0.35;
const CAMERA_CENTER_EPSILON_METERS = 0.12;
const EARTH_RADIUS_METERS = 6_371_000;

function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

function shortestAngularDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180;
}

function smoothHeading(previous: number, next: number, factor = 0.12) {
  const delta = shortestAngularDelta(previous, next);
  if (Math.abs(delta) < HEADING_DEADBAND_DEGREES) return previous;
  return normalizeDegrees(previous + delta * factor);
}

function getScreenRotation() {
  const modern = window.screen.orientation?.angle;
  if (typeof modern === 'number') return modern;
  const legacy = (window as WindowWithLegacyOrientation).orientation;
  return typeof legacy === 'number' ? legacy : 0;
}

function arZoomForFieldOfView(baseZoom: number, fieldOfViewDegrees: number) {
  const safeFov = Math.max(45, Math.min(100, fieldOfViewDegrees));
  const referenceTangent = Math.tan((AR_REFERENCE_FOV_DEGREES * Math.PI / 180) / 2);
  const requestedTangent = Math.tan((safeFov * Math.PI / 180) / 2);
  const zoomDelta = Math.log2(referenceTangent / requestedTangent);
  return Math.max(AR_MIN_ZOOM, Math.min(AR_MAX_ZOOM, Math.max(19.2, baseZoom) + zoomDelta));
}

function distanceMeters(a: Coordinate, b: Coordinate) {
  const lat1 = a.latitude * Math.PI / 180;
  const lat2 = b.latitude * Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * Math.PI / 180;
  const dLng = (b.longitude - a.longitude) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

function blendCoordinate(previous: Coordinate, next: Coordinate, factor: number): Coordinate {
  return {
    latitude: previous.latitude + (next.latitude - previous.latitude) * factor,
    longitude: previous.longitude + (next.longitude - previous.longitude) * factor
  };
}

function isMovingMotionClass(motionClass: MotionClass) {
  return motionClass === 'likely-walking'
    || motionClass === 'walking'
    || motionClass === 'jogging'
    || motionClass === 'possibly-driving';
}

export default function MapCameraController() {
  const maps = useMap();
  const cameraMode = useMapRuntimeStore((state) => state.cameraMode);
  const setArOrientation = useMapRuntimeStore((state) => state.setArOrientation);
  const setCameraMode = useMapRuntimeStore((state) => state.setCameraMode);
  const smoothedHeadingRef = useRef<number | null>(null);
  const gpsAnchorRef = useRef<Coordinate | null>(null);
  const stationaryCandidateRef = useRef<StationaryCandidate | null>(null);
  const lastTelemetryTimestampRef = useRef<string | null>(null);
  const lastPublishedFallbackAnchorRef = useRef<Coordinate | null>(null);

  useEffect(() => {
    function handleMode(event: Event) {
      const nextMode = (event as CustomEvent<MapCameraMode>).detail;
      if (nextMode) setCameraMode(nextMode);
    }

    window.addEventListener('buddies:map-camera-mode', handleMode);
    return () => window.removeEventListener('buddies:map-camera-mode', handleMode);
  }, [setCameraMode]);

  useEffect(() => {
    const compassEnabled = cameraMode === 'ar' || cameraMode === 'follow';
    if (!compassEnabled) {
      smoothedHeadingRef.current = null;
      return;
    }

    let orientationListening = false;
    let permissionRequested = false;

    function handleOrientation(event: DeviceOrientationEvent) {
      const oriented = event as OrientationEventWithWebkitHeading;
      const screenRotation = getScreenRotation();
      const rawHeading = typeof oriented.webkitCompassHeading === 'number'
        ? normalizeDegrees(oriented.webkitCompassHeading)
        : typeof event.alpha === 'number'
          ? normalizeDegrees(360 - event.alpha + screenRotation)
          : null;

      if (rawHeading == null || !Number.isFinite(rawHeading)) return;

      const previous = smoothedHeadingRef.current;
      const heading = previous == null ? normalizeDegrees(rawHeading) : smoothHeading(previous, rawHeading);
      smoothedHeadingRef.current = heading;
      setArOrientation({
        heading,
        pitch: typeof event.beta === 'number' ? event.beta : null,
        roll: typeof event.gamma === 'number' ? event.gamma : null
      });
      // Keep follow mode from holding on to an older GPS course after the user
      // turns. Compass updates are the freshest heading source when available.
      useMapRuntimeStore.getState().patchTelemetry({ heading });
    }

    function startListening() {
      if (orientationListening) return;
      orientationListening = true;
      window.addEventListener('deviceorientation', handleOrientation, true);
    }

    async function requestOrientationPermission() {
      if (permissionRequested) return;
      permissionRequested = true;
      const orientation = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };

      if (typeof orientation.requestPermission === 'function') {
        try {
          const permission = await orientation.requestPermission();
          if (permission !== 'granted') return;
        } catch {
          return;
        }
      }

      startListening();
    }

    // iOS requires the compass permission request to originate from a user
    // gesture. The first map interaction supplies that gesture in follow mode.
    window.addEventListener('pointerdown', requestOrientationPermission, { once: true, passive: true });
    window.addEventListener('touchstart', requestOrientationPermission, { once: true, passive: true });
    startListening();

    return () => {
      window.removeEventListener('pointerdown', requestOrientationPermission);
      window.removeEventListener('touchstart', requestOrientationPermission);
      window.removeEventListener('deviceorientation', handleOrientation, true);
      smoothedHeadingRef.current = null;
    };
  }, [cameraMode, setArOrientation]);

  useEffect(() => {
    const map = maps.current;
    if (!map || cameraMode !== 'ar') return;

    let frameId = 0;
    let disposed = false;

    const resizeMap = () => {
      window.requestAnimationFrame(() => {
        if (!disposed) map.resize();
      });
    };

    window.addEventListener('resize', resizeMap);
    window.addEventListener('orientationchange', resizeMap);
    window.visualViewport?.addEventListener('resize', resizeMap);
    window.screen.orientation?.addEventListener('change', resizeMap);
    resizeMap();

    const tick = () => {
      if (disposed) return;

      const state = useMapRuntimeStore.getState();
      const telemetry = state.telemetry;
      const tracking = state.arTracking;
      const hasSlamAnchor = (
        tracking.state === 'tracking'
        && tracking.source !== 'sensor-fusion'
        && tracking.source !== 'none'
        && tracking.anchorLatitude != null
        && tracking.anchorLongitude != null
      );

      let center: Coordinate | null = hasSlamAnchor
        ? {
            latitude: tracking.anchorLatitude as number,
            longitude: tracking.anchorLongitude as number
          }
        : null;

      if (!center && telemetry.latitude != null && telemetry.longitude != null) {
        const raw: Coordinate = {
          latitude: telemetry.latitude,
          longitude: telemetry.longitude
        };

        if (!gpsAnchorRef.current) {
          gpsAnchorRef.current = raw;
          stationaryCandidateRef.current = null;
        }

        if (telemetry.updatedAt !== lastTelemetryTimestampRef.current) {
          lastTelemetryTimestampRef.current = telemetry.updatedAt;
          const anchor = gpsAnchorRef.current ?? raw;
          const displacement = distanceMeters(anchor, raw);
          const accuracy = Math.max(3, telemetry.accuracyMeters ?? 50);
          const moving = isMovingMotionClass(telemetry.motionClass);

          if (moving) {
            const movementGate = Math.max(1.5, Math.min(6, accuracy * 0.15));
            if (displacement >= movementGate) {
              const factor = accuracy <= 12 ? 0.32 : accuracy <= 25 ? 0.2 : 0.11;
              gpsAnchorRef.current = blendCoordinate(anchor, raw, factor);
            }
            stationaryCandidateRef.current = null;
          } else {
            const stationaryGate = Math.max(8, Math.min(22, accuracy * 0.75));

            if (displacement > stationaryGate) {
              const candidate = stationaryCandidateRef.current;
              if (candidate && distanceMeters(candidate, raw) <= Math.max(4, accuracy * 0.25)) {
                candidate.count += 1;
                candidate.latitude = raw.latitude;
                candidate.longitude = raw.longitude;
                if (candidate.count >= 3) {
                  gpsAnchorRef.current = blendCoordinate(anchor, raw, 0.14);
                  stationaryCandidateRef.current = null;
                }
              } else {
                stationaryCandidateRef.current = { ...raw, count: 1 };
              }
            } else {
              stationaryCandidateRef.current = null;
            }
          }
        }

        center = gpsAnchorRef.current ?? raw;

        if (tracking.source === 'sensor-fusion') {
          const published = lastPublishedFallbackAnchorRef.current;
          if (!published || distanceMeters(published, center) >= 0.25) {
            lastPublishedFallbackAnchorRef.current = center;
            state.patchArTracking({
              anchorLatitude: center.latitude,
              anchorLongitude: center.longitude,
              updatedAt: new Date().toISOString()
            });
          }
        }
      }

      if (!center) {
        const current = map.getCenter();
        center = { latitude: current.lat, longitude: current.lng };
      }

      const desiredBearing = tracking.state === 'tracking'
        && tracking.heading != null
        && tracking.source !== 'sensor-fusion'
        ? tracking.heading
        : state.bearing;
      const desiredZoom = arZoomForFieldOfView(state.followZoom, state.arFieldOfViewDegrees);
      const currentCenter = map.getCenter();
      const centerDelta = distanceMeters(
        { latitude: currentCenter.lat, longitude: currentCenter.lng },
        center
      );
      const bearingDelta = Math.abs(shortestAngularDelta(map.getBearing(), desiredBearing));
      const zoomDelta = Math.abs(map.getZoom() - desiredZoom);
      const pitchDelta = Math.abs(map.getPitch() - 80);

      if (
        centerDelta >= CAMERA_CENTER_EPSILON_METERS
        || bearingDelta >= CAMERA_BEARING_EPSILON_DEGREES
        || zoomDelta >= 0.01
        || pitchDelta >= 0.1
      ) {
        // AR pose updates arrive faster than a short ease animation can settle.
        // jumpTo prevents overlapping animations from amplifying sensor noise.
        // Keep the tracked anchor at the viewport center in AR; adding a camera
        // offset at this pitch makes heading changes look like lateral drift.
        map.jumpTo({
          center: [center.longitude, center.latitude],
          zoom: desiredZoom,
          pitch: 80,
          bearing: desiredBearing
        });
      }

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resizeMap);
      window.removeEventListener('orientationchange', resizeMap);
      window.visualViewport?.removeEventListener('resize', resizeMap);
      window.screen.orientation?.removeEventListener('change', resizeMap);
      gpsAnchorRef.current = null;
      stationaryCandidateRef.current = null;
      lastTelemetryTimestampRef.current = null;
      lastPublishedFallbackAnchorRef.current = null;
    };
  }, [cameraMode, maps]);

  useEffect(() => {
    if (cameraMode === 'ar' || cameraMode === 'explore') return;

    const applyCamera = () => {
      const map = maps.current;
      if (!map) return;
      const state = useMapRuntimeStore.getState();
      const currentCenter = map.getCenter();
      const center: [number, number] = state.telemetry.latitude != null && state.telemetry.longitude != null
        ? [state.telemetry.longitude, state.telemetry.latitude]
        : [currentCenter.lng, currentCenter.lat];

      if (cameraMode === 'follow') {
        map.easeTo({
          center,
          zoom: state.followZoom,
          pitch: state.followPitch,
          bearing: state.telemetry.heading ?? state.bearing,
          offset: [0, 0],
          duration: 140,
          essential: true
        });
      } else if (cameraMode === 'overview') {
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
    };

    applyCamera();

    const unsubscribe = useMapRuntimeStore.subscribe((state, previous) => {
      if (
        state.cameraMode !== cameraMode
        || (
          state.telemetry.latitude === previous.telemetry.latitude
          && state.telemetry.longitude === previous.telemetry.longitude
          && state.telemetry.heading === previous.telemetry.heading
          && state.followZoom === previous.followZoom
          && state.followPitch === previous.followPitch
        )
      ) {
        return;
      }
      applyCamera();
    });

    return unsubscribe;
  }, [cameraMode, maps]);

  return null;
}
