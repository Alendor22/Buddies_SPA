'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  LOCATION_STATUS_EVENT,
  type LocationRuntimeStatusDetail
} from '@/lib/telemetry/locationStatus';
import { useMapRuntimeStore } from '@/stores/useMapRuntimeStore';

function formatElapsed(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/25 bg-slate-950/55 px-3 py-2 text-white shadow-xl backdrop-blur-xl">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">{label}</p>
      <p className="mt-0.5 truncate text-lg font-black tabular-nums">{value}</p>
    </div>
  );
}

function locationLabel(detail: LocationRuntimeStatusDetail) {
  switch (detail.status) {
    case 'active':
      return detail.accuracyMeters == null ? 'GPS LIVE' : `GPS ±${Math.round(detail.accuracyMeters)}m`;
    case 'denied':
      return 'GPS BLOCKED';
    case 'unavailable':
      return 'GPS UNAVAILABLE';
    case 'timeout':
      return 'GPS TIMEOUT';
    case 'error':
      return 'GPS ERROR';
    default:
      return 'GPS LOCATING';
  }
}

export default function WalkTelemetryHUD() {
  const telemetry = useMapRuntimeStore((state) => state.telemetry);
  const activeWalk = useMapRuntimeStore((state) => state.activeWalk);
  const uiMode = useMapRuntimeStore((state) => state.uiMode);
  const [locationStatus, setLocationStatus] = useState<LocationRuntimeStatusDetail>({
    status: telemetry.latitude != null && telemetry.longitude != null ? 'active' : 'requesting',
    message: 'Acquiring device location…',
    accuracyMeters: telemetry.accuracyMeters ?? undefined
  });

  useEffect(() => {
    function handleLocationStatus(event: Event) {
      const detail = (event as CustomEvent<LocationRuntimeStatusDetail>).detail;
      if (detail) setLocationStatus(detail);
    }

    window.addEventListener(LOCATION_STATUS_EVENT, handleLocationStatus);
    return () => window.removeEventListener(LOCATION_STATUS_EVENT, handleLocationStatus);
  }, []);

  const motionLabel = useMemo(
    () => telemetry.motionClass.replaceAll('-', ' ').toUpperCase(),
    [telemetry.motionClass]
  );
  const hasGpsFix = locationStatus.status === 'active'
    && telemetry.latitude != null
    && telemetry.longitude != null;

  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-30 sm:inset-x-5 sm:top-5">
      <div className="mx-auto flex max-w-3xl items-start justify-between gap-2">
        <div className="rounded-full border border-white/25 bg-slate-950/55 px-3 py-2 text-xs font-bold text-white shadow-xl backdrop-blur-xl">
          <span className="mr-2" aria-hidden="true">🐾</span>
          {activeWalk.startedAt ? (activeWalk.autoDetected ? 'AUTO WALK' : 'WALKING') : uiMode.replaceAll('-', ' ').toUpperCase()}
        </div>
        <div
          className="rounded-full border border-white/25 bg-slate-950/55 px-3 py-2 text-[11px] font-semibold text-white/90 shadow-xl backdrop-blur-xl"
          title={locationStatus.message}
        >
          {hasGpsFix
            ? `${motionLabel} · ${Math.round(telemetry.confidence * 100)}% · ${locationLabel(locationStatus)}`
            : locationLabel(locationStatus)}
        </div>
      </div>

      <div className="mx-auto mt-2 grid max-w-3xl grid-cols-4 gap-2">
        <Metric label="Distance" value={hasGpsFix ? `${telemetry.distanceMiles.toFixed(2)} mi` : '—'} />
        <Metric label="Time" value={hasGpsFix ? formatElapsed(telemetry.elapsedSeconds) : '—'} />
        <Metric label="Current" value={hasGpsFix ? `${telemetry.currentSpeedMph.toFixed(1)} mph` : '—'} />
        <Metric label="Average" value={hasGpsFix ? `${telemetry.averageSpeedMph.toFixed(1)} mph` : '—'} />
      </div>
    </div>
  );
}
