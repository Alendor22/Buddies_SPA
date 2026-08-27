'use client';

import { useMemo } from 'react';
import type { ActiveDogMapItem, ReportMapItem } from '@/components/map/LiveMapLayers';
import { useMapRuntimeStore } from '@/stores/useMapRuntimeStore';

type Props = {
  activeDogs: ActiveDogMapItem[];
  reports: ReportMapItem[];
};

type CameraEntity = {
  id: string;
  kind: 'dog' | 'report' | 'buddy';
  latitude: number;
  longitude: number;
  title: string;
  subtitle: string;
  icon: string;
  accent: string;
  maxDistanceMeters: number;
};

const EARTH_RADIUS_METERS = 6_371_000;
const METERS_TO_FEET = 3.28084;

function toRadians(value: number) {
  return value * Math.PI / 180;
}

function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

function angularDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180;
}

function distanceMeters(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

function bearingDegrees(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);
  const dLng = toRadians(toLng - fromLng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return normalizeDegrees(Math.atan2(y, x) * 180 / Math.PI);
}

function formatDistance(meters: number) {
  const feet = meters * METERS_TO_FEET;
  if (feet < 1000) return `${Math.max(1, Math.round(feet / 10) * 10)} ft`;
  return `${(feet / 5280).toFixed(1)} mi`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function ArSpatialLabels({ activeDogs, reports }: Props) {
  const cameraMode = useMapRuntimeStore((state) => state.cameraMode);
  const telemetry = useMapRuntimeStore((state) => state.telemetry);
  const bearing = useMapRuntimeStore((state) => state.bearing);
  const trackedLatitude = useMapRuntimeStore((state) => state.arTracking.anchorLatitude);
  const trackedLongitude = useMapRuntimeStore((state) => state.arTracking.anchorLongitude);
  const trackedHeading = useMapRuntimeStore((state) => state.arTracking.heading);
  const trackingSource = useMapRuntimeStore((state) => state.arTracking.source);
  const trackingState = useMapRuntimeStore((state) => state.arTracking.state);
  const fieldOfView = useMapRuntimeStore((state) => state.arFieldOfViewDegrees);
  const devicePitch = useMapRuntimeStore((state) => state.arDevicePitch);
  const layers = useMapRuntimeStore((state) => state.layers);
  const selectEntity = useMapRuntimeStore((state) => state.selectEntity);

  const labels = useMemo(() => {
    if (cameraMode !== 'ar') return [];

    const userLatitude = trackedLatitude ?? telemetry.latitude;
    const userLongitude = trackedLongitude ?? telemetry.longitude;
    if (userLatitude == null || userLongitude == null) return [];

    const slamHeadingActive = trackingState === 'tracking'
      && trackingSource !== 'sensor-fusion'
      && trackingSource !== 'none'
      && trackedHeading != null;
    const cameraBearing = slamHeadingActive ? trackedHeading as number : bearing;
    const entities: CameraEntity[] = [];

    if (layers.dogs || layers.buddies) {
      activeDogs.forEach((dog) => {
        entities.push({
          id: dog.id,
          kind: dog.isBuddy ? 'buddy' : 'dog',
          latitude: dog.device_loc.lat,
          longitude: dog.device_loc.lng,
          title: dog.dogName,
          subtitle: dog.isBuddy ? 'Buddy nearby' : dog.status.replaceAll('_', ' '),
          icon: dog.avatar || '🐕',
          accent: dog.isBuddy ? 'border-cyan-200/90 bg-cyan-950/80' : 'border-white/55 bg-slate-950/80',
          maxDistanceMeters: 805
        });
      });
    }

    if (layers.reports || layers.hazards) {
      reports.forEach((report) => {
        entities.push({
          id: report.id,
          kind: 'report',
          latitude: report.latitude,
          longitude: report.longitude,
          title: report.title,
          subtitle: report.type.replaceAll('_', ' '),
          icon: '!',
          accent: 'border-amber-200/90 bg-amber-950/85',
          maxDistanceMeters: 500
        });
      });
    }

    const halfFov = fieldOfView / 2;
    const pitchShift = devicePitch == null ? 0 : clamp((90 - devicePitch) * 0.18, -12, 12);

    return entities
      .map((entity) => {
        const distance = distanceMeters(
          userLatitude,
          userLongitude,
          entity.latitude,
          entity.longitude
        );
        const targetBearing = bearingDegrees(
          userLatitude,
          userLongitude,
          entity.latitude,
          entity.longitude
        );
        const delta = angularDelta(cameraBearing, targetBearing);
        const distanceFactor = 1 - clamp(distance / entity.maxDistanceMeters, 0, 1);
        return {
          ...entity,
          distance,
          delta,
          x: 50 + (delta / halfFov) * 46,
          y: clamp(54 + distanceFactor * 23 + pitchShift, 34, 82),
          scale: 0.78 + distanceFactor * 0.28,
          opacity: 0.68 + distanceFactor * 0.32
        };
      })
      .filter((entity) => entity.distance <= entity.maxDistanceMeters && Math.abs(entity.delta) <= halfFov)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 8);
  }, [activeDogs, bearing, cameraMode, devicePitch, fieldOfView, layers.buddies, layers.dogs, layers.hazards, layers.reports, reports, telemetry.latitude, telemetry.longitude, trackedHeading, trackedLatitude, trackedLongitude, trackingSource, trackingState]);

  if (cameraMode !== 'ar' || !labels.length) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden" aria-label="Nearby AR spatial labels">
      {labels.map((entity) => (
        <button
          key={`${entity.kind}-${entity.id}`}
          type="button"
          className={`pointer-events-auto absolute min-w-[7rem] max-w-[10rem] -translate-x-1/2 -translate-y-full rounded-2xl border px-3 py-2 text-left text-white shadow-2xl backdrop-blur-xl transition-[transform,opacity] duration-150 ${entity.accent}`}
          style={{
            left: `${entity.x}%`,
            top: `${entity.y}%`,
            opacity: entity.opacity,
            transform: `translate(-50%, -100%) scale(${entity.scale})`
          }}
          onClick={() => selectEntity({
            id: entity.id,
            kind: entity.kind,
            latitude: entity.latitude,
            longitude: entity.longitude,
            title: entity.title
          })}
        >
          <span className="flex items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/15 text-sm font-black">{entity.icon}</span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-black">{entity.title}</span>
              <span className="block truncate text-[9px] font-semibold uppercase tracking-wide text-white/65">{entity.subtitle}</span>
            </span>
          </span>
          <span className="mt-1 block text-[10px] font-black text-white/90">{formatDistance(entity.distance)}</span>
          <span className="absolute left-1/2 top-full h-5 w-px -translate-x-1/2 bg-gradient-to-b from-white/80 to-transparent" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
