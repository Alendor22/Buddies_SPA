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
import MapCameraController from './MapCameraController';

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
  const setCameraMode = useMapRuntimeStore((state) => state.setCameraMode);
  const [activeDogs, setActiveDogs] = useState<ActiveDogMapItem[]>([]);
  const [heatCells, setHeatCells] = useState<HeatCellMapItem[]>([]);
  const [reports, setReports] = useState<ReportMapItem[]>([]);
  const [pendingReportType, setPendingReportType] = useState<string | null>(null);
  const [status, setStatus] = useState('Map ready. Walk detection starts when location permission is available.');

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

      {token ? (
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
          mapStyle="mapbox://styles/mapbox/streets-v12"
          minZoom={2}
          maxZoom={22}
          maxPitch={85}
          dragRotate
          touchPitch
          doubleClickZoom
          attributionControl
          cursor={pendingReportType ? 'crosshair' : cameraMode === 'explore' ? 'grab' : 'default'}
          onDragStart={() => setCameraMode('explore')}
          onClick={(event) => {
            if (!pendingReportType) return;
            void placeReport(event.lngLat.lat, event.lngLat.lng);
          }}
          onLoad={() => setStatus('Buddies spatial map online.')}
          onError={(event) => setStatus(`Mapbox render error: ${event.error?.message || 'unknown error'}`)}
        >
          <MapCameraController />
          <LiveMapLayers
            activeDogs={activeDogs}
            heatCells={heatCells}
            reports={reports}
            showRadar={layers.dogs || layers.buddies}
            showHeat={layers.heat}
            showReports={layers.reports || layers.hazards}
          />

          {telemetry.latitude != null && telemetry.longitude != null ? (
            <Marker latitude={telemetry.latitude} longitude={telemetry.longitude} anchor="center" rotation={telemetry.heading ?? 0} rotationAlignment="map">
              <div className="grid h-12 w-12 place-items-center rounded-full border-4 border-white bg-slate-950 text-xl shadow-2xl ring-4 ring-sky-300/40" aria-label="Your current location">🐾</div>
            </Marker>
          ) : null}
        </Map>
      ) : (
        <div className="grid h-full place-items-center p-8 text-center">
          <div className="max-w-md rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur-xl">
            <h1 className="text-xl font-black">Buddies spatial map</h1>
            <p className="mt-2 text-sm text-white/65">{loading ? 'Loading Mapbox configuration…' : (error || 'Mapbox configuration is unavailable.')}</p>
            {!loading ? <button type="button" onClick={() => void refresh()} className="mt-4 rounded-xl bg-white px-4 py-3 font-bold text-slate-950">Retry</button> : null}
          </div>
        </div>
      )}

      <WalkTelemetryHUD />
      <MapActionBar />
      <SpatialOverlaySheet activeDogs={activeDogs} />

      <div className="pointer-events-none absolute bottom-24 left-3 z-30 max-w-[min(78vw,28rem)] rounded-full border border-white/20 bg-slate-950/55 px-3 py-2 text-[11px] font-semibold text-white/75 shadow-xl backdrop-blur-xl" role="status">
        {pendingReportType ? '📍 ' : ''}{status}
      </div>
    </main>
  );
}
