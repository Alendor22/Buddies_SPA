'use client';

import { useEffect, useRef } from 'react';
import { classifyMotion } from '@/lib/telemetry/classifyMotion';
import {
  locationErrorDetail,
  publishLocationStatus
} from '@/lib/telemetry/locationStatus';
import {
  distanceMeters,
  stabilizePedestrianPosition,
  type StabilizedPedestrianPosition
} from '@/lib/telemetry/pedestrianPositionFilter';
import { useMapRuntimeStore } from '@/stores/useMapRuntimeStore';

type Sample = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  speedMph: number;
  timestamp: number;
};

const METERS_PER_MILE = 1609.344;
const MAX_SAMPLE_AGE_MS = 60_000;
const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 1_000,
  timeout: 15_000
};

function normalizeHeading(value: number) {
  return ((value % 360) + 360) % 360;
}

function bearingBetween(
  from: Pick<StabilizedPedestrianPosition, 'latitude' | 'longitude'>,
  to: Pick<StabilizedPedestrianPosition, 'latitude' | 'longitude'>
) {
  const lat1 = from.latitude * Math.PI / 180;
  const lat2 = to.latitude * Math.PI / 180;
  const deltaLongitude = (to.longitude - from.longitude) * Math.PI / 180;
  const y = Math.sin(deltaLongitude) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2)
    - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLongitude);
  return normalizeHeading(Math.atan2(y, x) * 180 / Math.PI);
}

export default function AutoWalkDetector({ enabled = true }: { enabled?: boolean }) {
  const samplesRef = useRef<Sample[]>([]);
  const lastAcceptedRef = useRef<StabilizedPedestrianPosition | null>(null);
  const totalDistanceMetersRef = useRef(0);
  const movingSecondsRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    if (!navigator.geolocation) {
      publishLocationStatus({
        status: 'unavailable',
        message: 'This browser does not expose device location.'
      });
      return;
    }

    let receivedFix = false;

    publishLocationStatus({
      status: 'requesting',
      message: 'Acquiring a high-accuracy GPS fix…'
    });

    const handlePosition = (position: GeolocationPosition) => {
      receivedFix = true;
      const now = position.timestamp || Date.now();
      const coords = position.coords;
      const last = lastAcceptedRef.current;
      const accuracyMeters = Number.isFinite(coords.accuracy) && coords.accuracy >= 0 ? coords.accuracy : 999;
      const gpsSpeedMph = coords.speed != null && coords.speed >= 0 ? coords.speed * 2.236936 : null;
      const stabilized = stabilizePedestrianPosition(last, {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracyMeters,
        timestamp: now,
        speedMph: gpsSpeedMph
      });

      publishLocationStatus({
        status: 'active',
        message: `GPS active within approximately ${Math.round(accuracyMeters)} meters.`,
        accuracyMeters
      });

      if (!stabilized) {
        const state = useMapRuntimeStore.getState();
        state.patchTelemetry({
          accuracyMeters,
          confidence: Math.min(state.telemetry.confidence, 20),
          updatedAt: new Date(now).toISOString()
        });
        return;
      }

      const dtSeconds = last ? Math.max(0.1, (now - last.timestamp) / 1000) : 0;
      const deltaMeters = last ? stabilized.filteredDeltaMeters : 0;
      const inferredSpeedMph = dtSeconds > 0 ? (deltaMeters / METERS_PER_MILE) / (dtSeconds / 3600) : 0;
      const speedMph = Math.max(0, accuracyMeters <= 25 && gpsSpeedMph != null ? gpsSpeedMph : inferredSpeedMph);

      const sample: Sample = {
        latitude: stabilized.latitude,
        longitude: stabilized.longitude,
        accuracyMeters,
        speedMph,
        timestamp: now
      };

      const plausibleMovement = !last || (!stabilized.held && deltaMeters <= 150 && inferredSpeedMph <= 20);

      if (last && plausibleMovement && deltaMeters >= 1) {
        totalDistanceMetersRef.current += deltaMeters;
        if (speedMph >= 0.5 && speedMph <= 8) movingSecondsRef.current += dtSeconds;
      }

      lastAcceptedRef.current = { ...stabilized, speedMph };
      samplesRef.current = [...samplesRef.current, sample].filter((entry) => now - entry.timestamp <= MAX_SAMPLE_AGE_MS);

      const window = samplesRef.current;
      const first = window[0] ?? sample;
      const displacement = distanceMeters(first, sample);
      const windowSeconds = Math.max(1, (sample.timestamp - first.timestamp) / 1000);
      const state = useMapRuntimeStore.getState();
      const gpsHeading = coords.heading != null
        && Number.isFinite(coords.heading)
        && (gpsSpeedMph ?? speedMph) >= 0.5
        ? normalizeHeading(coords.heading)
        : null;
      const inferredHeading = last && deltaMeters >= 1.5 && speedMph >= 0.5
        ? bearingBetween(last, stabilized)
        : null;
      const heading = gpsHeading ?? inferredHeading ?? state.telemetry.heading;
      const classification = classifyMotion({
        speedMph,
        accuracyMeters,
        displacementMeters: displacement,
        windowSeconds,
        priorClass: state.telemetry.motionClass
      });

      const elapsedSeconds = state.activeWalk.startedAt
        ? Math.max(0, (Date.now() - new Date(state.activeWalk.startedAt).getTime()) / 1000)
        : 0;
      const distanceMiles = totalDistanceMetersRef.current / METERS_PER_MILE;
      const averageSpeedMph = movingSecondsRef.current > 0
        ? distanceMiles / (movingSecondsRef.current / 3600)
        : 0;

      state.patchTelemetry({
        latitude: sample.latitude,
        longitude: sample.longitude,
        accuracyMeters,
        heading,
        currentSpeedMph: speedMph,
        averageSpeedMph,
        distanceMiles,
        elapsedSeconds,
        movingSeconds: movingSecondsRef.current,
        motionClass: classification.motionClass,
        confidence: classification.confidence,
        updatedAt: new Date(now).toISOString()
      });

      if (classification.shouldStartWalk && !state.activeWalk.startedAt) {
        state.startWalk({
          autoDetected: true,
          startedAt: new Date(now).toISOString(),
          startLatitude: sample.latitude,
          startLongitude: sample.longitude
        });
      } else if (classification.shouldPauseWalk && state.activeWalk.startedAt && !state.activeWalk.pausedAt) {
        state.pauseWalk();
      } else if (classification.shouldStopWalk && state.activeWalk.startedAt) {
        state.endWalk();
      }
    };

    const handleError = (error: GeolocationPositionError) => {
      if (receivedFix && error.code === error.TIMEOUT) return;
      publishLocationStatus(locationErrorDetail(error));
      useMapRuntimeStore.getState().patchTelemetry({
        currentSpeedMph: 0,
        confidence: 0
      });
    };

    // Bootstrap a fix immediately. On iOS this also makes location acquisition failures
    // observable instead of leaving the telemetry HUD silently pinned at zero.
    navigator.geolocation.getCurrentPosition(handlePosition, handleError, GEOLOCATION_OPTIONS);
    const watchId = navigator.geolocation.watchPosition(handlePosition, handleError, GEOLOCATION_OPTIONS);

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled]);

  return null;
}
