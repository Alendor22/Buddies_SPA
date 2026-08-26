'use client';

import { useCallback, useEffect, useState } from 'react';
import Map, { Marker } from 'react-map-gl/mapbox';
import LiveMapLayers, {
  type ActiveDogMapItem,
  type HeatCellMapItem,
  type ReportMapItem
} from '@/components/map/LiveMapLayers';
import MapActionBar from '@/components/map/hud/MapActionBar';
import WalkTelemetryHUD from '@/components/map/hud/WalkTelemetryHUD';
import SpatialOverlaySheet from '@/components/map/interactions/SpatialOverlaySheet';
import AutoWalkDetector from '@/components/map/telemetry/AutoWalkDetector';
import { useMapboxConfig } from '@/components/providers/MapboxProvider';
import { DEFAULT_CENTER } from '@/stores/useBuddiesStore';
import { useMapRuntimeStore } from '@/stores/useMapRuntimeStore';
import ArCameraPermissionHelp from './ArCameraPermissionHelp';
import MapArCamera from './MapArCamera';
import MapArEnvironment from './MapArEnvironment';
import MapCameraController from './MapCameraController';
import ArOverlayControls from './ArOverlayControls';
import ArSpatialLabels from './ArSpatialLabels';
import type { ArCameraStatus, ArCameraStatusDetail } from './arTypes';

type SocialMapPayload = {
  activeDogs?: ActiveDogMapItem[];
  heatCells?: HeatCellMapItem[];
  reports?: ReportMapItem[];
  error?: string;
};

export default function BuddiesSpatialMap() {
  const { token, loading, error, refresh } = useMapboxConfig();
  const telemetry = useMapRuntimeStore((state) => state.telemetry);
  const cameraMode = useMapRuntimeStore((state) => state.cameraMode);
  const layers = useMapRuntimeStore((state) => state.layers);
  const arOverlayOpacity = useMapRuntimeStore((state) => state.arOverlayOpacity);
  const setCameraMode = useMapRuntimeStore((state) => state.setCameraMode);
  const [activeDogs, setActiveDogs] = useState<ActiveDogMapItem[]>([]);
  const [heatCells, setHeatCells] = useState<HeatCellMapItem[]>([]);
  const [reports, setReports] = useState<ReportMapItem[]>([]);
  const [pendingReportType, setPendingReportType] = useState<string | null>(null);
  const [status, setStatus] = useState('Map ready. Walk detection starts when location permission is available.');
  const [arOrientationStatus, setArOrientationStatus] = useState<'granted' | 'denied' | 'unavailable' | null>(null);
  const [arCameraStatus, setArCameraStatus] = useState<ArCameraStatus>('idle');

  const loadSocialMap = useCallback(async () => {
    const query = new URLSearchParams();
    if (telemetry.latitude != null && telemetry.longitude != null) {
      query.set('lat', telemetry.latitude.toFixed(6));
      query.set('lng', telemetry.longitude.toFixed(6));
    }
    try {
      const response = await fetch(`/api/social-map${query.size ? `?${query.toString()}` : ''}`, { cache: 'no-store' });
      const payload = await response.json() as SocialMapPayload;
      if (!response.ok) throw new Error(payload.error || 'Social map unavailable.');
      setActiveDogs(payload.activeDogs ?? []);
      setHeatCells(payload.heatCells ?? []);
      setReports(payload.reports ?? []);
    } catch (loadError) {
      setStatus(loadError instanceof Error ? loadError.message : 'Social map unavailable.');
    }
  }, [telemetry.latitude, telemetry.longitude]);

  useEffect(() => {
    void loadSocialMap();
    const timer = window.setInterval(() => void loadSocialMap(), 8_000);
    return () => window.clearInterval(timer);
  }, [loadSocialMap]);

  useEffect(() => {
    function beginReport(event: Event) {
      const type = (event as CustomEvent<{ type?: string }>).detail?.type;
      if (!type) return;
      setPendingReportType(type);
      setStatus(`${type.replaceAll('_', ' ')} selected. Tap the map where it applies.`);
    }
    window.addEventListener('buddies:create-map-report', beginReport);
    return () => window.removeEventListener('buddies:create-map-report', beginReport);
  }, []);

  useEffect(() => {
    function handlePermission(event: Event) {
      const permission = (event as CustomEvent<'granted' | 'denied' | 'unavailable'>).detail;
      setArOrientationStatus(permission);
      if (permission === 'denied') {
        setStatus('AR camera is active, but device-heading permission was denied. Bearing will use map/GPS heading.');
      } else if (permission === 'granted') {
        setStatus('AR camera active. Move the phone to steer the spatial overlay.');
      } else {
        setStatus('AR camera active. Device orientation is unavailable; using GPS/map heading.');
      }
    }

    window.addEventListener('buddies:ar-orientation-permission', handlePermission);
    return () => window.removeEventListener('buddies:ar-orientation-permission', handlePermission);
  }, []);

  useEffect(() => {
    function handleCameraStatus(event: Event) {
      const detail = (event as CustomEvent<ArCameraStatusDetail>).detail;
      if (!detail) return;
      setArCameraStatus(detail.status);
      setStatus(detail.message);
    }

    window.addEventListener('buddies:ar-camera-status', handleCameraStatus);
    return () => window.removeEventListener('buddies:ar-camera-status', handleCameraStatus);
  }, []);

  async function placeReport(latitude: number, longitude: number) {
    if (!pendingReportType) return;
    setStatus('Publishing report…');
    try {
      const response = await fetch('/api/social-map/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: pendingReportType, latitude, longitude })
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Report could not be published.');
      setPendingReportType(null);
      setStatus('Report published to the local pack.');
      await loadSocialMap();
    } catch (reportError) {
      setStatus(reportError instanceof Error ? reportError.message : 'Report could not be published.');
    }
  }

  return (
    <main className="relative h-[100dvh] min-h-[540px] w-full overflow-hidden bg-slate-950 text-white">
      <AutoWalkDetector />
      <MapArCamera />

      {token ? (
        <div
          className="absolute inset-0 z-10 transition-opacity duration-200"
          style={{ opacity: cameraMode === 'ar' ? arOverlayOpacity : 1 }}
        >
          <Map
            id="buddies-spatial-map"
            mapboxAccessToken={token}
            reuseMaps
            initialViewState={{
              latitude: DEFAULT_CENTER.lat,
              longitude: DEFAULT_CENTER.lng,
              zoom: 16.5,
              pitch: 50,
              bearing: 0
            }}
            style={{ width: '100%', height: '100%' }}
            mapStyle="mapbox://styles/mapbox/streets-v12"
            minZoom={2}
            maxZoom={22}
            maxPitch={85}
            dragPan={cameraMode !== 'ar'}
            dragRotate={cameraMode !== 'ar'}
            touchPitch={cameraMode !== 'ar'}
            doubleClickZoom={cameraMode !== 'ar'}
            attributionControl
            cursor={pendingReportType ? 'crosshair' : cameraMode === 'explore' ? 'grab' : 'default'}
            onDragStart={() => {
              if (cameraMode !== 'ar') setCameraMode('explore');
            }}
            onClick={(event) => {
              if (!pendingReportType) return;
              void placeReport(event.lngLat.lat, event.lngLat.lng);
            }}
            onLoad={() => setStatus('Buddies spatial map online.')}
            onError={(event) => setStatus(`Mapbox render error: ${event.error?.message || 'unknown error'}`)}
          >
            <MapCameraController />
            <MapArEnvironment />
            <LiveMapLayers
              activeDogs={activeDogs}
              heatCells={heatCells}
              reports={reports}
              showRadar={(layers.dogs || layers.buddies) && cameraMode !== 'ar'}
              showHeat={layers.heat}
              showReports={(layers.reports || layers.hazards) && cameraMode !== 'ar'}
            />

            {telemetry.latitude != null && telemetry.longitude != null ? (
              <Marker latitude={telemetry.latitude} longitude={telemetry.longitude} anchor="center" rotation={telemetry.heading ?? 0} rotationAlignment="map">
                <div className="grid h-12 w-12 place-items-center rounded-full border-4 border-white bg-slate-950 text-xl shadow-2xl ring-4 ring-sky-300/40" aria-label="Your current location">🐾</div>
              </Marker>
            ) : null}
          </Map>
        </div>
      ) : (
        <div className="relative z-10 grid h-full place-items-center p-8 text-center">
          <div className="max-w-md rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur-xl">
            <h1 className="text-xl font-black">Buddies spatial map</h1>
            <p className="mt-2 text-sm text-white/65">{loading ? 'Loading Mapbox configuration…' : (error || 'Mapbox configuration is unavailable.')}</p>
            {!loading ? <button type="button" onClick={() => void refresh()} className="mt-4 rounded-xl bg-white px-4 py-3 font-bold text-slate-950">Retry</button> : null}
          </div>
        </div>
      )}

      {cameraMode === 'ar' ? (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-30 flex justify-center px-4">
            <div className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white shadow-2xl backdrop-blur-xl ${arCameraStatus === 'ready' ? 'border-emerald-300/60 bg-emerald-950/70' : arCameraStatus === 'denied' || arCameraStatus === 'error' ? 'border-red-300/60 bg-red-950/75' : 'border-sky-300/50 bg-slate-950/70'}`}>
              {arCameraStatus === 'ready' ? 'AR CAMERA LIVE' : arCameraStatus === 'requesting' ? 'STARTING AR CAMERA' : arCameraStatus === 'denied' ? 'CAMERA PERMISSION BLOCKED' : arCameraStatus === 'unavailable' ? 'CAMERA UNAVAILABLE' : arCameraStatus === 'error' ? 'CAMERA ERROR' : 'AR STARTING'} · {arOrientationStatus === 'granted' ? 'DEVICE HEADING' : 'MAP HEADING'}
            </div>
          </div>
          <ArCameraPermissionHelp status={arCameraStatus} />
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-200/80 shadow-[0_0_30px_rgba(125,211,252,0.45)]">
            <div className="absolute left-1/2 top-0 h-4 w-px -translate-x-1/2 bg-sky-100/90" />
            <div className="absolute bottom-0 left-1/2 h-4 w-px -translate-x-1/2 bg-sky-100/90" />
            <div className="absolute left-0 top-1/2 h-px w-4 -translate-y-1/2 bg-sky-100/90" />
            <div className="absolute right-0 top-1/2 h-px w-4 -translate-y-1/2 bg-sky-100/90" />
          </div>
          <div className="pointer-events-none absolute inset-x-[12%] top-[61%] z-20 h-px bg-gradient-to-r from-transparent via-sky-200/60 to-transparent" />
        </>
      ) : null}

      <ArSpatialLabels activeDogs={activeDogs} reports={reports} />
      <ArOverlayControls />
      <WalkTelemetryHUD />
      <MapActionBar />
      <SpatialOverlaySheet activeDogs={activeDogs} />

      <div className="pointer-events-none absolute bottom-24 left-3 z-30 max-w-[min(78vw,28rem)] rounded-full border border-white/20 bg-slate-950/55 px-3 py-2 text-[11px] font-semibold text-white/75 shadow-xl backdrop-blur-xl" role="status">
        {pendingReportType ? '📍 ' : ''}{status}
      </div>
    </main>
  );
}
