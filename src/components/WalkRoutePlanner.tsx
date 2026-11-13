Warning: truncated output (original token count: 9278)
Total output lines: 948

'use client';

import { useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import Map, {
  GeolocateControl,
  Layer,
  Marker,
  NavigationControl,
  Source,
  type MapRef
} from 'react-map-gl/mapbox';
import LiveMapLayers, {
  type ActiveDogMapItem,
  type HeatCellMapItem,
  type ReportMapItem
} from '@/components/map/LiveMapLayers';
import { useMapboxConfig } from '@/components/providers/MapboxProvider';
import {
  DEFAULT_CENTER,
  DEFAULT_VIEW_FEET,
  type Coordinate,
  type SavedRoute,
  useBuddiesStore
} from '@/stores/useBuddiesStore';
import { shouldFallbackToDirectMapbox } from '@/lib/maps/routingPolicy';

type DirectionsPayload = {
  geometry: Coordinate[];
  steps: Array<{
    instruction: string;
    street: string | null;
    distanceFeet: number;
    durationSeconds: number;
  }>;
  distanceMiles: number;
  durationMinutes: number;
};

type MapPressEvent = {
  lngLat: { lat: number; lng: number };
  preventDefault?: () => void;
  originalEvent?: { preventDefault?: () => void };
};

type Props = {
  activeDogs?: ActiveDogMapItem[];
  heatCells?: HeatCellMapItem[];
  reports?: ReportMapItem[];
  showRadar?: boolean;
  showHeat?: boolean;
  showReports?: boolean;
};

const EARTH_RADIUS_MILES = 3958.8;
const FEET_PER_MILE = 5280;
const ZOOM_STEP_FEET = 20;
const MIN_VIEW_FEET = 40;
const MAX_VIEW_FEET = 5 * FEET_PER_MILE;
const ESTIMATED_MAP_WIDTH_PX = 640;
const MAX_WAYPOINTS = 20;
const ROUTE_CLIENT_TIMEOUT_MS = 75_000;
const LONG_PRESS_MS = 650;
const TOUCH_MOVE_CANCEL_PX = 12;
const MAX_RANDOM_LOOP_MILES = 1;

function createRandomRouteRolls(): [number, number] {
  return [Math.random(), Math.random()];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeFeet(value: number) {
  return Math.round(clamp(value, MIN_VIEW_FEET, MAX_VIEW_FEET) / ZOOM_STEP_FEET) * ZOOM_STEP_FEET;
}

function zoomForFeet(viewFeet: number, latitude: number) {
  const visibleWidthMeters = Math.max(1, viewFeet * 2 * 0.3048);
  const metersPerPixelAtZoomZero = 156543.03392 * Math.cos(latitude * Math.PI / 180);
  return clamp(Math.log2((metersPerPixelAtZoomZero * ESTIMATED_MAP_WIDTH_PX) / visibleWidthMeters), 8, 21);
}

function feetForZoom(zoom: number, latitude: number) {
  const metersPerPixel = (156543.03392 * Math.cos(latitude * Math.PI / 180)) / (2 ** zoom);
  return normalizeFeet((metersPerPixel * ESTIMATED_MAP_WIDTH_PX / 0.3048) / 2);
}

function destination(start: Coordinate, miles: number, bearingDegrees: number): Coordinate {
  const bearing = bearingDegrees * Math.PI / 180;
  const lat1 = start.lat * Math.PI / 180;
  const lng1 = start.lng * Math.PI / 180;
  const distance = miles / EARTH_RADIUS_MILES;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distance)
      + Math.cos(lat1) * Math.sin(distance) * Math.cos(bearing)
  );
  const lng2 = lng1 + Math.atan2(
    Math.sin(bearing) * Math.sin(distance) * Math.cos(lat1),
    Math.cos(distance) - Math.sin(lat1) * Math.sin(lat2)
  );
  return {
    lat: Number((lat2 * 180 / Math.PI).toFixed(6)),
    lng: Number((lng2 * 180 / Math.PI).toFixed(6))
  };
}

function bearingBetween(start: Coordinate, end: Coordinate) {
  const lat1 = start.lat * Math.PI / 180;
  const lat2 = end.lat * Math.PI / 180;
  const deltaLng = (end.lng - start.lng) * Math.PI / 180;
  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2)
    - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

function distanceScore(a: Coordinate, b: Coordinate) {
  return Math.abs(a.lat - b.lat) + Math.abs(a.lng - b.lng);
}

function midpoint(a: Coordinate, b: Coordinate): Coordinate {
  return {
    lat: Number(((a.lat + b.lat) / 2).toFixed(6)),
    lng: Number(((a.lng + b.lng) / 2).toFixed(6))
  };
}

function circleFeature(center: Coordinate, miles: number) {
  const points = Array.from({ length: 65 }, (_, index) => {
    const point = destination(center, miles, index * (360 / 64));
    return [point.lng, point.lat];
  });
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Polygon' as const, coordinates: [points] }
  };
}

function boundsForRoute(route: Coordinate[]) {
  if (!route.length) return null;
  const lngs = route.map((point) => point.lng);
  const lats = route.map((point) => point.lat);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)]
  ] as [[number, number], [number, number]];
}

function pointFromEvent(event: MapPressEvent): Coordinate {
  return {
    lat: Number(event.lngLat.lat.toFixed(6)),
    lng: Number(event.lngLat.lng.toFixed(6))
  };
}

function formatStep(step: { instruction: string; distanceFeet: number }) {
  return `${step.instruction}${step.distanceFeet ? ` · ${step.distanceFeet.toLocaleString()} ft` : ''}`;
}

export default function WalkRoutePlanner({
  activeDogs = [],
  heatCells = [],
  reports = [],
  showRadar = true,
  showHeat = true,
  showReports = true
}: Props) {
  const mapRef = useRef<MapRef | null>(null);
  const routeAbortRef = useRef<AbortController | null>(null);
  const ignoreNextClickRef = useRef(false);
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [draggingHandle, setDraggingHandle] = useState<string | null>(null);
  const [snapPreviewRoute, setSnapPreviewRoute] = useState<Coordinate[]>([]);
  const { token, loading: mapConfigLoading, error: mapConfigError, refresh: refreshMapConfig } = useMapboxConfig();
  const { walkPlanner, patchWalkPlanner, resetRoute } = useBuddiesStore();
  const {
    center,
    start,
    apex,
    waypoints,
    status,
    apexMiles,
    routeName,
    route,
    routeSteps,
    distanceMiles,
    durationMinutes,
    favorites,
    viewFeet,
    routingState,
    routingError,
    savingFavorite,
    mapLoaded,
    mapUpdatedAt
  } = walkPlanner;
  const routing = routingState === 'routing';
  const editPoints = useMemo(() => [start || center, ...waypoints], [center, start, waypoints]);
  const tempLoopPoints = useMemo(
    () => editPoints.length ? [...editPoints, editPoints[0]] : [],
    [editPoints]
  );

  useEffect(() => {
    let active = true;
    async function initialize() {
      await useBuddiesStore.persist.rehydrate();
      if (!active) return;
      const latest = useBuddiesStore.getState().walkPlanner;
      if (latest.viewFeet < DEFAULT_VIEW_FEET || latest.apexMiles > MAX_RANDOM_LOOP_MILES) {
        patchWalkPlanner({
          viewFeet: Math.max(latest.viewFeet, DEFAULT_VIEW_FEET),
          apexMiles: latest.apexMiles > MAX_RANDOM_LOOP_MILES ? 0.5 : latest.apexMiles
        });
      }
      try {
        const response = await fetch('/api/walk-routes/favorites', { cache: 'no-store' });
        const payload = await response.json() as { favorites?: SavedRoute[] };
        if (active && response.ok) patchWalkPlanner({ favorites: payload.favorites ?? [] });
      } catch {}
    }
    void initialize();
    return () => {
      active = false;
      routeAbortRef.current?.abort();
      if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
      if (revealTimerRef.current) clearInterval(revealTimerRef.current);
    };
  }, [patchWalkPlanner]);

  const routeFeature = useMemo(() => ({
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: route.map((point) => [point.lng, point.lat])
    }
  }), [route]);

  const snapPreviewFeature = useMemo(() => ({
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: snapPreviewRoute.map((point) => [point.lng, point.lat])
    }
  }), [snapPreviewRoute]);

  const tempRouteFeature = useMemo(() => ({
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: tempLoopPoints.map((point) => [point.lng, point.lat])
    }
  }), [tempLoopPoints]);

  const boundaryFeature = useMemo(() => circleFeature(start || center, 5), [start, center]);
  const routeHandles = useMemo(() => tempLoopPoints.slice(0, -1).map((point, index) => ({
    id: `segment-${index}`,
    index,
    point: midpoint(point, tempLoopPoints[index + 1])
  })), [tempLoopPoints]);

  function setStartPoint(coordinate: Coordinate) {
    setSnapPreviewRoute([]);
    patchWalkPlanner({
      center: coordinate,
      start: coordinate,
      apex: null,
      status: 'Start fixed. Long press to add flags. The dotted route remains editable until routed.',
      routingState: 'plotting',
      routingError: null
    });
    resetRoute();
  }

  function addWaypoint(coordinate: Coordinate) {
    if (waypoints.length >= MAX_WAYPOINTS) {
      patchWalkPlanner({ status: `Maximum of ${MAX_WAYPOINTS} flag waypoints reached.` });
      return;
    }
    setSnapPreviewRoute([]);
    patchWalkPlanner({
      waypoints: [...waypoints, coordinate],
      apex: null,
      routingState: 'plotting',
      routingError: null,
      status: `Flag ${waypoints.length + 1} added. Drag handles to choose alternate streets.`
    });
    resetRoute();
  }

  function updateWaypoint(index: number, coordinate: Coordinate) {
    setSnapPreviewRoute([]);
    patchWalkPlanner({
      waypoints: waypoints.map((point, pointIndex) => pointIndex === index ? coordinate : point),
      routingState: 'plotting',
      routingError: null,
      status: `Flag ${index + 1} moved. Route again when ready.`
    });
    resetRoute();
  }

  function insertWaypointAfter(segmentIndex: number, coordinate: Coordinate) {
    const next = [...waypoints];
    next.splice(segmentIndex, 0, coordinate);
    setSnapPreviewRoute([]);
    patchWalkPlanner({
      waypoints: next.slice(0, MAX_WAYPOINTS),
      routingState: 'plotting',
      routingError: null,
      status: 'Alternate-street shaping point inserted.'
    });
    resetRoute();
  }

  function repositionNearest(coordinate: Coordinate) {
    const candidates = [
      ...(start ? [{ type: 'start' as const, index: -1, point: start }] : []),
      ...waypoints.map((point, index) => ({ type: 'waypoint' as const, index, point }))
    ];
    const nearest = candidates.sort(
      (a, b) => distanceScore(a.point, coordinate) - distanceScore(b.point, coordinate)
    )[0];
    if (!nearest || nearest.type === 'start') {
      setStartPoint(coordinate);
      return;
    }
    updateWaypoint(nearest.index, coordinate);
  }

  function locate() {
    if (!navigator.geolocation) {
      patchWalkPlanner({ status: 'Location services are unavailable.' });
      return;
    }
    patchWalkPlanner({ status: 'Requesting current location…' });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const current = {
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6))
        };
        setStartPoint(current);
        mapRef.current?.flyTo({
          center: [current.lng, current.lat],
          zoom: zoomForFeet(DEFAULT_VIEW_FEET, current.lat),
          duration: 900
        });
      },
      () => patchWalkPlanner({ status: 'Location permission was denied. Tap the map to set Start.' }),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  }

  function handleShortPress(event: MapPressEvent) {
    if (ignoreNextClickRef.current) {
      ignoreNextClickRef.current = false;
      return;
    }
    setStartPoint(pointFromEvent(event));
  }

  function handleLongPress(event: MapPressEvent) {
    event.preventDefault?.();
    event.originalEvent?.preventDefault?.();
    ignoreNextClickRef.current = true;
    addWaypoint(pointFromEvent(event));
  }

  function handleDoubleTap(event: MapPressEvent) {
    event.preventDef…3278 tokens truncated…Use location</button>
        <button type="button" onClick={() => { if (routing) { cancelRouting(); return; } void generateStreetRoute(...createRandomRouteRolls()); }} className={`rounded-lg px-4 py-3 font-medium text-white backdrop-blur ${routing ? 'bg-red-700/60' : 'bg-slate-950/50'}`}>{routing ? 'Cancel routing' : 'Route to streets'}</button>
        <button type="button" disabled={savingFavorite} onClick={saveFavorite} className="rounded-lg border border-white/40 bg-white/50 px-4 py-3 font-medium text-slate-950 backdrop-blur disabled:opacity-50">{savingFavorite ? 'Saving…' : 'Save route'}</button>
        <button type="button" onClick={clearRoute} className="rounded-lg border border-white/40 bg-white/50 px-4 py-3 font-medium text-slate-950 backdrop-blur">Clear route</button>
      </div>

      <p className="rounded-lg bg-white/50 px-3 py-2 text-sm text-slate-800 backdrop-blur" role="status">{status}</p>

      <div
        className="relative h-[min(68vh,720px)] min-h-[460px] touch-none overflow-hidden rounded-2xl border border-white/30 bg-slate-100"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {token ? (
          <Map
            id="walk-planner-map"
            ref={mapRef}
            reuseMaps
            mapboxAccessToken={token}
            initialViewState={{
              latitude: center.lat,
              longitude: center.lng,
              zoom: zoomForFeet(viewFeet, center.lat)
            }}
            mapStyle="mapbox://styles/mapbox/streets-v12"
            dragRotate={false}
            touchPitch={false}
            doubleClickZoom={false}
            cursor="crosshair"
            onClick={handleShortPress}
            onContextMenu={handleLongPress}
            onDblClick={handleDoubleTap}
            onLoad={() => {
              const latest = useBuddiesStore.getState().walkPlanner;
              mapRef.current?.jumpTo({
                center: [latest.center.lng, latest.center.lat],
                zoom: zoomForFeet(Math.max(latest.viewFeet, DEFAULT_VIEW_FEET), latest.center.lat)
              });
              patchWalkPlanner({
                mapLoaded: true,
                viewFeet: Math.max(latest.viewFeet, DEFAULT_VIEW_FEET),
                apexMiles: latest.apexMiles > MAX_RANDOM_LOOP_MILES ? 0.5 : latest.apexMiles,
                status: 'Map loaded. Tap Start, long press flags, drag handles for alternate streets.'
              });
            }}
            onError={(event) => patchWalkPlanner({
              mapLoaded: false,
              status: `Mapbox failed to render: ${event.error?.message || 'unknown map error'}`
            })}
            onMoveEnd={(event) => {
              const nextCenter = event.target.getCenter();
              patchWalkPlanner({
                center: { lat: nextCenter.lat, lng: nextCenter.lng },
                viewFeet: Math.max(DEFAULT_VIEW_FEET, feetForZoom(event.target.getZoom(), nextCenter.lat))
              });
            }}
          >
            <NavigationControl position="top-right" showCompass={false} />
            <GeolocateControl position="top-right" trackUserLocation showUserHeading={false} />

            <LiveMapLayers
              activeDogs={activeDogs}
              heatCells={heatCells}
              reports={reports}
              showRadar={showRadar}
              showHeat={showHeat}
              showReports={showReports}
            />

            <Source id="walk-boundary" type="geojson" data={boundaryFeature}>
              <Layer id="walk-boundary-fill" type="fill" paint={{ 'fill-color': '#0ea5e9', 'fill-opacity': 0.04 }} />
              <Layer id="walk-boundary-line" type="line" paint={{ 'line-color': '#0284c7', 'line-width': 2, 'line-opacity': 0.55 }} />
            </Source>

            {tempLoopPoints.length > 1 ? (
              <Source id="temp-route" type="geojson" data={tempRouteFeature}>
                <Layer id="temp-route-line" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': '#f59e0b', 'line-width': draggingHandle ? 6 : 4, 'line-dasharray': [1.5, 1.5], 'line-opacity': draggingHandle ? 1 : 0.8 }} />
              </Source>
            ) : null}

            {snapPreviewRoute.length > 1 ? (
              <Source id="snap-preview-route" type="geojson" data={snapPreviewFeature}>
                <Layer id="snap-preview-route-line" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': '#0284c7', 'line-width': 6, 'line-dasharray': [0.8, 1.2], 'line-opacity': 0.98 }} />
              </Source>
            ) : null}

            {route.length > 1 ? (
              <Source id="walk-route" type="geojson" data={routeFeature}>
                <Layer id="walk-route-line" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': '#0284c7', 'line-width': 7, 'line-opacity': 0.95 }} />
              </Source>
            ) : null}

            {start ? (
              <Marker
                latitude={start.lat}
                longitude={start.lng}
                anchor="bottom"
                draggable
                onDragStart={() => setDraggingHandle('start')}
                onDragEnd={(event) => {
                  setDraggingHandle(null);
                  setStartPoint(pointFromEvent(event));
                }}
              >
                <button type="button" className={`rounded-xl border-2 border-white bg-slate-900 px-3 py-2 text-xs font-bold text-white shadow-lg ${draggingHandle === 'start' ? 'animate-pulse' : ''}`}>Start</button>
              </Marker>
            ) : null}

            {waypoints.map((waypoint, index) => (
              <Marker
                key={`${waypoint.lat}-${waypoint.lng}-${index}`}
                latitude={waypoint.lat}
                longitude={waypoint.lng}
                anchor="bottom"
                draggable
                onDragStart={() => setDraggingHandle(`waypoint-${index}`)}
                onDragEnd={(event) => {
                  setDraggingHandle(null);
                  updateWaypoint(index, pointFromEvent(event));
                }}
              >
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeWaypoint(index);
                  }}
                  className={`relative flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-amber-500 text-2xl shadow-lg ${draggingHandle === `waypoint-${index}` ? 'animate-pulse' : ''}`}
                  title={`Flag ${index + 1}. Tap to remove, drag to move.`}
                >
                  <span aria-hidden="true">🚩</span>
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-900 px-1 text-[10px] font-bold text-white">{index + 1}</span>
                </button>
              </Marker>
            ))}

            {routeHandles.map((handle) => (
              <Marker
                key={handle.id}
                latitude={handle.point.lat}
                longitude={handle.point.lng}
                anchor="center"
                draggable
                onDragStart={() => {
                  setDraggingHandle(handle.id);
                  patchWalkPlanner({ status: 'Route handle selected. Drag it toward the alternate street.' });
                }}
                onDragEnd={(event) => {
                  setDraggingHandle(null);
                  insertWaypointAfter(handle.index, pointFromEvent(event));
                }}
              >
                <button type="button" className={`grid h-9 w-9 place-items-center rounded-full border-4 border-white bg-blue-500 text-xs font-black text-white shadow-lg ${draggingHandle === handle.id ? 'animate-pulse ring-4 ring-blue-300' : ''}`} title="Drag to bend the temporary route">↕</button>
              </Marker>
            ))}
          </Map>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-slate-600">
            <p>{mapConfigLoading ? 'Loading Mapbox configuration…' : (mapConfigError || 'Mapbox public configuration is unavailable.')}</p>
            {!mapConfigLoading ? <button type="button" onClick={() => void refreshMapConfig()} className="rounded-lg border px-3 py-2 font-medium">Retry map configuration</button> : null}
          </div>
        )}

        <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-white/50 px-3 py-1 text-xs font-semibold shadow backdrop-blur">+{viewFeet.toLocaleString()} ft</div>
        {token && !mapLoaded ? <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/50 px-3 py-1 text-xs font-semibold shadow backdrop-blur">Loading Mapbox…</div> : null}
      </div>

      <section className="rounded-xl border border-white/40 bg-white/50 p-4 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Temporary route points</h3>
            <p className="text-sm text-slate-600">Start plus {waypoints.length} flag{waypoints.length === 1 ? '' : 's'}; the final leg returns to Start.</p>
          </div>
          <button type="button" disabled={!waypoints.length} onClick={() => removeWaypoint(waypoints.length - 1)} className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-40">Undo last flag</button>
        </div>
      </section>

      <label className="grid gap-2 text-sm font-medium">Route name
        <input value={routeName} onChange={(event) => patchWalkPlanner({ routeName: event.target.value })} className="rounded-lg border bg-white/70 px-3 py-3 text-base backdrop-blur" />
      </label>

      {routingError ? <p className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm font-medium text-red-700 backdrop-blur" role="alert">{routingError}</p> : null}

      {routeSteps.length ? (
        <div className="rounded-xl border bg-white/60 p-4 text-sm text-slate-700 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">Driving route</p>
            <p>{distanceMiles?.toFixed(2)} mi · {durationMinutes} min</p>
          </div>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            {routeSteps.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}
          </ol>
        </div>
      ) : null}

      <div className="rounded-xl bg-white/50 p-4 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Favorite routes</h3>
          <p className="text-xs text-slate-500">Map configuration: {token ? 'provider ready' : mapConfigLoading ? 'loading' : 'unavailable'}</p>
        </div>
        <div className="mt-3 grid gap-2">
          {favorites.length === 0 ? <p className="text-sm text-slate-600">No account favorites saved yet.</p> : favorites.map((favorite) => (
            <div key={favorite.id} className="rounded-xl border bg-white/60 p-3">
              <button type="button" onClick={() => loadFavorite(favorite)} className="w-full text-left">
                <span className="block font-medium">{favorite.name}</span>
                <span className="block text-sm text-slate-500">{favorite.distanceMiles ? `${favorite.distanceMiles.toFixed(2)} mi` : 'Distance unavailable'}{favorite.durationMinutes ? ` · ${favorite.durationMinutes} min` : ''}</span>
              </button>
              <button type="button" onClick={() => deleteFavorite(favorite.id)} className="mt-2 text-xs font-medium text-red-700 underline">Remove favorite</button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
