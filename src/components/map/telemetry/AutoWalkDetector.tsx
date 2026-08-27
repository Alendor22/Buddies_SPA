'use client';

import { useEffect, useRef } from 'react';
import { classifyMotion } from '@/lib/telemetry/classifyMotion';
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

export default function AutoWalkDetector({ enabled = true }: { enabled?: boolean }) {
  const samplesRef = useRef<Sample[]>([]);
  const lastAcceptedRef = useRef<StabilizedPedestrianPosition | null>(null);
  const totalDistanceMetersRef = useRef(0);
  const movingSecondsRef = useRef(0);

  useEffect(() => {
    if (!enabled || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition((position) => {
      const now = position.timestamp || Date.now();
      const coords = position.coords;
      const accuracyMeters = Math.max(0, coords.accuracy || 999);
      const gpsSpeedMph = coords.speed != null && coords.speed >= 0 ? coords.speed * 2.236936 : null;
      const previous = lastAcceptedRef.current;

      const stabilized = stabilizePedestrianPosition(previous, {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracyMeters,
        timestamp: now,
        speedMph: gpsSpeedMph
      });

      const state = useMapRuntimeStore.getState();

      if (!stabilized) {
        state.patchTelemetry({
          accuracyMeters,
          confidence: Math.min(state.telemetry.confidence, 20),
          updatedAt: new Date(now).toISOString()
        });
        return;
      }

      const dtSeconds = previous ? Math.max(0.1, (now - previous.timestamp) / 1000) : 0;
      const deltaMeters = previous ? stabilized.filteredDeltaMeters : 0;
      const inferredSpeedMph = dtSeconds > 0
        ? (deltaMeters / METERS_PER_MILE) / (dtSeconds / 3600)
        : 0;
      const speedMph = Math.max(
        0,
        accuracyMeters <= 25 && gpsSpeedMph != null ? gpsSpeedMph : inferredSpeedMph
      );

      const sample: Sample = {
        latitude: stabilized.latitude,
        longitude: stabilized.longitude,
        accuracyMeters,
        speedMph,
        timestamp: now
      };

      const plausibleMovement = !previous || (
        deltaMeters <= 150
        && inferredSpeedMph <= 20
      );

      if (previous && plausibleMovement && !stabilized.held && deltaMeters >= 1) {
        if (speedMph <= 8) totalDistanceMetersRef.current += deltaMeters;
        if (speedMph >= 0.5 && speedMph <= 8) movingSecondsRef.current += dtSeconds;
      }

      lastAcceptedRef.current = {
        ...stabilized,
        speedMph
      };

      samplesRef.current = [...samplesRef.current, sample].filter((entry) => now - entry.timestamp <= MAX_SAMPLE_AGE_MS);

      const window = samplesRef.current;
      const first = window[0] ?? sample;
      const displacement = distanceMeters(first, sample);
      const windowSeconds = Math.max(1, (sample.timestamp - first.timestamp) / 1000);
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
        heading: coords.heading,
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
    }, () => {
      useMapRuntimeStore.getState().patchTelemetry({ confidence: 0, updatedAt: new Date().toISOString() });
    }, {
      enableHighAccuracy: true,
      maximumAge: 5_000,
      timeout: 15_000
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled]);

  return null;
}
