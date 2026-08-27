'use client';

import { useEffect, useRef } from 'react';
import { classifyMotion } from '@/lib/telemetry/classifyMotion';
import {
  distanceMeters,
  filterPedestrianPosition,
  type PositionFilterState
} from '@/lib/telemetry/filterPosition';
import { useMapRuntimeStore } from '@/stores/useMapRuntimeStore';

type Sample = PositionFilterState & {
  speedMph: number;
};

const METERS_PER_MILE = 1609.344;
const MAX_SAMPLE_AGE_MS = 60_000;

export default function AutoWalkDetector({ enabled = true }: { enabled?: boolean }) {
  const samplesRef = useRef<Sample[]>([]);
  const lastAcceptedRef = useRef<Sample | null>(null);
  const positionFilterRef = useRef<PositionFilterState | null>(null);
  const totalDistanceMetersRef = useRef(0);
  const movingSecondsRef = useRef(0);

  useEffect(() => {
    if (!enabled || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition((position) => {
      const now = position.timestamp || Date.now();
      const coords = position.coords;
      const accuracyMeters = Math.max(0, coords.accuracy || 999);
      const gpsSpeedMph = coords.speed != null && coords.speed >= 0 ? coords.speed * 2.236936 : null;
      const state = useMapRuntimeStore.getState();

      const filtered = filterPedestrianPosition(positionFilterRef.current, {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracyMeters,
        timestamp: now,
        speedMph: gpsSpeedMph
      });

      if (!filtered.accepted) {
        state.patchTelemetry({
          accuracyMeters,
          updatedAt: new Date(now).toISOString()
        });
        return;
      }

      positionFilterRef.current = filtered.state;
      const last = lastAcceptedRef.current;
      const dtSeconds = last ? Math.max(0.1, (now - last.timestamp) / 1000) : 0;
      const deltaMeters = last ? distanceMeters(last, filtered.state) : 0;
      const inferredSpeedMph = dtSeconds > 0 ? (deltaMeters / METERS_PER_MILE) / (dtSeconds / 3600) : 0;
      const speedMph = Math.max(0, gpsSpeedMph ?? inferredSpeedMph);

      const sample: Sample = {
        ...filtered.state,
        speedMph
      };

      if (last && filtered.moved && deltaMeters >= 1.5) {
        totalDistanceMetersRef.current += deltaMeters;
        if (speedMph >= 0.5 && speedMph <= 8) movingSecondsRef.current += dtSeconds;
      }

      lastAcceptedRef.current = sample;
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
