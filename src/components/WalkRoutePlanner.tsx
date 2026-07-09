'use client';

import { useEffect, useMemo, useRef } from 'react';
import Map, { GeolocateControl, Layer, Marker, NavigationControl, Source, type MapRef } from 'react-map-gl/mapbox';
import { DEFAULT_CENTER, DEFAULT_VIEW_FEET, type Coordinate, type SavedRoute, useBuddiesStore } from '@/stores/useBuddiesStore';

type DirectionsPayload = {
  geometry: Coordinate[];
  steps: Array<{ instruction: string; street: string | null; distanceFeet: number; durationSeconds: number }>;
  distanceMiles: number;
  durationMinutes: number;
};

type MapPressEvent = {
  lngLat: { lat: number; lng: number };
  preventDefault?: () => void;
  originalEvent?: { preventDefault?: () => void };
};

type Props = { initialToken: string };

const EARTH_RADIUS_MILES = 3958.8;
const FEET_PER_MILE = 5280;
const ZOOM_STEP_FEET = 20;
const MIN_VIEW_FEET = 40;
const MAX_VIEW_FEET = 5 * FEET_PER_MILE;
const ESTIMATED_MAP_WIDTH_PX = 640;
const MAX_WAYPOINTS = 20;
const ROUTE_CLIENT_TIMEOUT_MS = 45_000;

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
  const visibleWidthFeet = metersPerPixel * ESTIMATED_MAP_WIDTH_PX / 0.3048;
  return normalizeFeet(visibleWidthFeet / 2);
}

function destination(start: Coordinate, miles: number, bearingDegrees: number): Coordinate {
  const bearing = bearingDegrees * Math.PI / 180;
  const lat1 = start.lat * Math.PI / 180;
  const lng1 = start.lng * Math.PI / 180;
  const distance = miles / EARTH_RADIUS_MILES;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(distance) + Math.cos(lat1) * Math.sin(distance) * Math.cos(bearing));
  const lng2 = lng1 + Math.atan2(Math.sin(bearing) * Math.sin(distance) * Math.cos(lat1), Math.cos(distance) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: Number((lat2 * 180 / Math.PI).toFixed(6)), lng: Number((lng2 * 180 / Math.PI).toFixed(6)) };
}

function bearingBetween(start: Coordinate, end: Coordinate) {
  const lat1 = start.lat * Math.PI / 180;
  const lat2 = end.lat * Math.PI / 180;
  const deltaLng = (end.lng - start.lng) * Math.PI / 180;
  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

function distanceScore(a: Coordinate, b: Coordinate) {
  return Math.abs(a.lat - b.lat) + Math.abs(a.lng - b.lng);
}

function circleFeature(center: Coordinate, miles: number) {
  const points = Array.from({ length: 65 }, (_, index) => {
    const point = destination(center, miles, index * (360 / 64));
    return [point.lng, point.lat];
  });
  return { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [points] } };
}

function boundsForRoute(route: Coordinate[]) {
  if (!route.length) return null;
  const lngs = route.map((point) => point.lng);
  const lats = route.map((point) => point.lat);
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]] as [[number, number], [number, number]];
}

function pointFromEvent(event: MapPressEvent): Coordinate {
  return { lat: Number(event.lngLat.lat.toFixed(6)), lng: Number(event.lngLat.lng.toFixed(6)) };
}

export default function WalkRoutePlanner({ initialToken }: Props) {
  const mapRef = useRef<MapRef | null>(null);
  const routeAbortRef = useRef<AbortController | null>(null);
  const ignoreNextClickRef = useRef(false);
  const { walkPlanner, hydrateMapToken, patchWalkPlanner, resetRoute } = useBuddiesStore();
  const {
    token: cachedToken,
    tokenCachedAt,
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

  const token = initialToken || cachedToken;
  const routing = routingState === 'routing';

  useEffect(() => {
    let active = true;
    async function initialize() {
      await useBuddiesStore.persist.rehydrate();
      if (!active) return;
      if (initialToken) hydrateMapToken(initialToken);
      else if (!useBuddiesStore.getState().walkPlanner.token) {
        try {
          const response = await fetch(`/api/maps/config?ts=${Date.now()}`, { cache: 'no-store' });
          const payload = await response.json() as { token?: string; error?: string };
          if (active && response.ok && payload.token) hydrateMapToken(payload.token);
          else if (active) patchWalkPlanner({ status: payload.error || 'Mapbox token unavailable.' });
        } catch {
          if (active) patchWalkPlanner({ status: 'Map configuration could not be loaded.' });
        }
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
    };
  }, [hydrateMapToken, initialToken, patchWalkPlanner]);

  const routeFeature = useMemo(() => ({
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'LineString' as const, coordinates: route.map((point) => [point.lng, point.lat]) }
  }), [route]);

  const waypointGuideFeature = useMemo(() => ({
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'LineString' as const, coordinates: [start, ...waypoints].filter((point): point is Coordinate => Boolean(point)).map((point) => [point.lng, point.lat]) }
  }), [start, waypoints]);

  const boundaryFeature = useMemo(() => circleFeature(start || center, 5), [start, center]);

  function applyViewFeet(value: number) {
    const next = normalizeFeet(value);
    patchWalkPlanner({ viewFeet: next });
    const map = mapRef.current;
    const current = map?.getCenter();
    const latitude = current?.lat ?? center.lat;
    map?.flyTo({ center: current ? [current.lng, current.lat] : [center.lng, center.lat], zoom: zoomForFeet(next, latitude), duration: 250 });
  }

  function setStartPoint(coordinate: Coordinate) {
    patchWalkPlanner({
      center: coordinate,
      start: coordinate,
      apex: null,
      status: 'Start point fixed. Long press the map to add waypoints. The route will loop back to Start.',
      routingState: 'idle',
      routingError: null
    });
    resetRoute();
  }

  function addWaypoint(coordinate: Coordinate) {
    if (waypoints.length >= MAX_WAYPOINTS) {
      patchWalkPlanner({ status: `Maximum of ${MAX_WAYPOINTS} flag waypoints reached.` });
      return;
    }
    patchWalkPlanner({
      waypoints: [...waypoints, coordinate],
      apex: null,
      routingState: 'plotting',
      routingError: null,
      status: `Waypoint ${waypoints.length + 1} added. Route snapping will follow waypoint order and loop back to Start.`
    });
    resetRoute();
  }

  function repositionNearest(coordinate: Coordinate) {
    if (!start && !waypoints.length) {
      setStartPoint(coordinate);
      return;
    }

    const candidates = [
      ...(start ? [{ type: 'start' as const, index: -1, point: start }] : []),
      ...waypoints.map((point, index) => ({ type: 'waypoint' as const, index, point }))
    ];
    const nearest = candidates.sort((a, b) => distanceScore(a.point, coordinate) - distanceScore(b.point, coordinate))[0];

    if (!nearest || nearest.type === 'start') {
      setStartPoint(coordinate);
      patchWalkPlanner({ status: 'Start point repositioned. Long press to add waypoints.' });
      return;
    }

    patchWalkPlanner({
      waypoints: waypoints.map((point, index) => index === nearest.index ? coordinate : point),
      routingState: 'plotting',
      routingError: null,
      status: `Waypoint ${nearest.index + 1} repositioned. Generate the street route again.`
    });
    resetRoute();
  }

  function locate() {
    if (!navigator.geolocation) {
      patchWalkPlanner({ status: 'Location services are unavailable. Short press the map to set Start.' });
      return;
    }
    patchWalkPlanner({ status: 'Requesting current location…' });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const current = { lat: Number(position.coords.latitude.toFixed(6)), lng: Number(position.coords.longitude.toFixed(6)) };
        setStartPoint(current);
        mapRef.current?.flyTo({ center: [current.lng, current.lat], zoom: zoomForFeet(DEFAULT_VIEW_FEET, current.lat), duration: 900 });
      },
      () => patchWalkPlanner({ status: 'Location permission was denied. Short press the map to set Start.' }),
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
    event.preventDefault?.();
    event.originalEvent?.preventDefault?.();
    ignoreNextClickRef.current = true;
    repositionNearest(pointFromEvent(event));
  }

  function removeWaypoint(index: number) {
    patchWalkPlanner({ waypoints: waypoints.filter((_, waypointIndex) => waypointIndex !== index), status: `Waypoint ${index + 1} removed.` });
    resetRoute();
  }

  function clearRoute() {
    patchWalkPlanner({ apex: null, waypoints: [], route: [], routeSteps: [], distanceMiles: null, durationMinutes: null, routingState: 'idle', routingError: null, status: 'Route cleared. Short press to set Start, long press to add waypoints.' });
  }

  function cancelRouting() {
    routeAbortRef.current?.abort();
    routeAbortRef.current = null;
    patchWalkPlanner({ routingState: 'cancelled', routingError: null, status: 'Street routing cancelled.' });
  }

  async function generateStreetRoute() {
    if (routing) {
      cancelRouting();
      return;
    }

    const base = start || center;
    let selectedApex = apex;
    let coordinates: Coordinate[];

    if (waypoints.length) {
      coordinates = [base, ...waypoints, base];
    } else {
      const outboundBearing = apex ? bearingBetween(base, apex) : Math.random() * 360;
      selectedApex = apex || destination(base, apexMiles, outboundBearing);
      const returnWaypoint = destination(selectedApex, Math.max(0.05, apexMiles * 0.3), outboundBearing + 135 + Math.random() * 90);
      coordinates = [base, selectedApex, returnWaypoint, base];
    }

    const controller = new AbortController();
    routeAbortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), ROUTE_CLIENT_TIMEOUT_MS);
    patchWalkPlanner({ routingState: 'routing', routingError: null, status: `Snapping ${coordinates.length - 1} route segment${coordinates.length === 2 ? '' : 's'} to walkable streets…` });

    try {
      const response = await fetch('/api/maps/directions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ coordinates }), signal: controller.signal, cache: 'no-store' });
      const payload = await response.json() as DirectionsPayload & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Street routing failed.');
      patchWalkPlanner({
        apex: waypoints.length ? null : selectedApex,
        route: payload.geometry,
        routeSteps: payload.steps.map((step) => `${step.instruction}${step.distanceFeet ? ` · ${step.distanceFeet.toLocaleString()} ft` : ''}`),
        distanceMiles: payload.distanceMiles,
        durationMinutes: payload.durationMinutes,
        routingState: 'success',
        routingError: null,
        status: `Street route snapped through ${waypoints.length} waypoint${waypoints.length === 1 ? '' : 's'} and looped back to Start.`
      });
      const bounds = boundsForRoute(payload.geometry);
      if (bounds) mapRef.current?.fitBounds(bounds, { padding: 55, duration: 900 });
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === 'AbortError';
      if (routingState === 'cancelled') return;
      resetRoute();
      patchWalkPlanner({
        routingState: timedOut ? 'timeout' : 'error',
        routingError: timedOut ? 'Street routing exceeded 45 seconds. Try fewer waypoints or move points closer to mapped streets.' : error instanceof Error ? error.message : 'Street routing failed.',
        status: timedOut ? 'Street routing timed out.' : 'Street routing failed.'
      });
    } finally {
      window.clearTimeout(timeout);
      if (routeAbortRef.current === controller) routeAbortRef.current = null;
    }
  }

  const routeJson = JSON.stringify({ name: routeName, routeEngine: 'mapbox/directions-walking', center, start, apexPoint: apex, waypoints, apexMiles, route, routeSteps, distanceMiles, durationMinutes, viewFeet, mapUpdatedAt });

  async function saveFavorite() {
    if (!route.length) {
      patchWalkPlanner({ status: 'Generate a street route before saving it.' });
      return;
    }
    patchWalkPlanner({ savingFavorite: true, status: 'Saving favorite route to your account…' });
    try {
      const response = await fetch('/api/walk-routes/favorites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ routeJson }) });
      const payload = await response.json() as { favorite?: SavedRoute; error?: string };
      if (!response.ok || !payload.favorite) throw new Error(payload.error || 'Favorite route could not be saved.');
      patchWalkPlanner({ favorites: [payload.favorite, ...favorites].slice(0, 20), savingFavorite: false, status: 'Favorite route saved to your account.' });
    } catch (error) {
      patchWalkPlanner({ savingFavorite: false, status: error instanceof Error ? error.message : 'Favorite route could not be saved.' });
    }
  }

  async function deleteFavorite(id: string) {
    try {
      const response = await fetch('/api/walk-routes/favorites', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      if (!response.ok) throw new Error('Favorite route could not be removed.');
      patchWalkPlanner({ favorites: favorites.filter((favorite) => favorite.id !== id), status: 'Favorite route removed.' });
    } catch (error) {
      patchWalkPlanner({ status: error instanceof Error ? error.message : 'Favorite route could not be removed.' });
    }
  }

  function loadFavorite(saved: SavedRoute) {
    const data = JSON.parse(saved.routeJson) as { name?: string; center?: Coordinate; start?: Coordinate; apexPoint?: Coordinate; waypoints?: Coordinate[]; apexMiles?: number; route?: Coordinate[]; routeSteps?: string[]; distanceMiles?: number; durationMinutes?: number; viewFeet?: number };
    const loadedRoute = data.route ?? [];
    const loadedCenter = data.center ?? data.start ?? DEFAULT_CENTER;
    patchWalkPlanner({ routeName: data.name || saved.name, center: loadedCenter, apexMiles: data.apexMiles || 1, start: data.start || loadedCenter, apex: data.apexPoint || null, waypoints: Array.isArray(data.waypoints) ? data.waypoints.slice(0, MAX_WAYPOINTS) : [], route: loadedRoute, routeSteps: data.routeSteps || [], distanceMiles: data.distanceMiles ?? saved.distanceMiles ?? null, durationMinutes: data.durationMinutes ?? saved.durationMinutes ?? null, viewFeet: normalizeFeet(data.viewFeet || DEFAULT_VIEW_FEET), routingState: loadedRoute.length ? 'success' : 'idle', routingError: null, status: `Loaded favorite route: ${saved.name}.` });
    const bounds = boundsForRoute(loadedRoute);
    if (bounds) mapRef.current?.fitBounds(bounds, { padding: 55, duration: 800 });
    else mapRef.current?.flyTo({ center: [loadedCenter.lng, loadedCenter.lat], zoom: zoomForFeet(data.viewFeet || DEFAULT_VIEW_FEET, loadedCenter.lat), duration: 700 });
  }

  return (
    <section className="grid gap-5 rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
      <div>
        <h2 className="text-xl font-semibold">Interactive walk route planner</h2>
        <p className="mt-1 text-sm text-slate-600">Short press sets Start. Long press adds a waypoint. Double tap repositions the nearest Start/waypoint. Street routing snaps each segment and loops back to Start.</p>
      </div>

      <input type="hidden" name="routeName" value={routeName} />
      <input type="hidden" name="routeJson" value={routeJson} />

      <div className="grid gap-2 sm:grid-cols-4">
        <button type="button" onClick={locate} className="rounded-lg bg-slate-900 px-4 py-3 font-medium text-white">Use current location</button>
        <button type="button" onClick={generateStreetRoute} className={`rounded-lg px-4 py-3 font-medium text-white ${routing ? 'bg-red-700' : 'bg-slate-900'}`}>{routing ? 'Cancel routing' : 'Snap route to streets'}</button>
        <button type="button" disabled={savingFavorite} onClick={saveFavorite} className="rounded-lg border px-4 py-3 font-medium disabled:opacity-50">{savingFavorite ? 'Saving…' : 'Save favorite'}</button>
        <button type="button" onClick={clearRoute} className="rounded-lg border px-4 py-3 font-medium">Clear route</button>
      </div>

      <div className="grid gap-3 rounded-xl border bg-slate-50 p-3">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Zoom in by 20 feet" onClick={() => applyViewFeet(viewFeet - ZOOM_STEP_FEET)} className="h-11 w-11 rounded-lg border bg-white text-xl font-bold">+</button>
          <input aria-label="Map view radius in feet" type="range" min={MIN_VIEW_FEET} max={MAX_VIEW_FEET} step={ZOOM_STEP_FEET} value={viewFeet} onChange={(event) => applyViewFeet(Number(event.target.value))} className="min-w-0 flex-1" />
          <button type="button" aria-label="Zoom out by 20 feet" onClick={() => applyViewFeet(viewFeet + ZOOM_STEP_FEET)} className="h-11 w-11 rounded-lg border bg-white text-xl font-bold">−</button>
        </div>
        <p className="text-xs font-semibold text-slate-600">View radius: +{viewFeet.toLocaleString()} ft · session snapshot {mapUpdatedAt ? new Date(mapUpdatedAt).toLocaleTimeString() : 'not saved'}</p>
      </div>

      <p className="text-sm text-slate-600" role="status">{status}</p>

      <div className="relative h-[460px] overflow-hidden rounded-2xl border bg-slate-100">
        {token ? (
          <Map
            id="walk-planner-map"
            ref={mapRef}
            reuseMaps
            mapboxAccessToken={token}
            initialViewState={{ latitude: center.lat, longitude: center.lng, zoom: zoomForFeet(viewFeet, center.lat) }}
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
              mapRef.current?.jumpTo({ center: [latest.center.lng, latest.center.lat], zoom: zoomForFeet(latest.viewFeet, latest.center.lat) });
              patchWalkPlanner({ mapLoaded: true, status: 'Map loaded. Short press to set Start; long press to add waypoints.' });
            }}
            onError={(event) => patchWalkPlanner({ mapLoaded: false, status: `Mapbox failed to render: ${event.error?.message || 'unknown map error'}` })}
            onMoveEnd={(event) => {
              const nextCenter = event.target.getCenter();
              patchWalkPlanner({ center: { lat: nextCenter.lat, lng: nextCenter.lng }, viewFeet: feetForZoom(event.target.getZoom(), nextCenter.lat) });
            }}
          >
            <NavigationControl position="top-right" showCompass={false} />
            <GeolocateControl position="top-right" trackUserLocation showUserHeading={false} />
            <Source id="walk-boundary" type="geojson" data={boundaryFeature}>
              <Layer id="walk-boundary-fill" type="fill" paint={{ 'fill-color': '#0ea5e9', 'fill-opacity': 0.04 }} />
              <Layer id="walk-boundary-line" type="line" paint={{ 'line-color': '#0284c7', 'line-width': 2, 'line-opacity': 0.55 }} />
            </Source>
            {waypoints.length ? <Source id="waypoint-guide" type="geojson" data={waypointGuideFeature}><Layer id="waypoint-guide-line" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': '#f59e0b', 'line-width': 3, 'line-dasharray': [2, 2], 'line-opacity': 0.8 }} /></Source> : null}
            {route.length > 1 ? <Source id="walk-route" type="geojson" data={routeFeature}><Layer id="walk-route-line" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': '#0284c7', 'line-width': 7, 'line-opacity': 0.95 }} /></Source> : null}
            {start ? <Marker latitude={start.lat} longitude={start.lng} anchor="bottom"><button type="button" onDoubleClick={(event) => event.stopPropagation()} className="rounded-xl border-2 border-white bg-slate-900 px-3 py-2 text-xs font-bold text-white shadow-lg">Start</button></Marker> : null}
            {apex ? <Marker latitude={apex.lat} longitude={apex.lng} anchor="bottom"><div className="rounded-xl border-2 border-white bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 shadow-lg">Apex</div></Marker> : null}
            {waypoints.map((waypoint, index) => <Marker key={`${waypoint.lat}-${waypoint.lng}-${index}`} latitude={waypoint.lat} longitude={waypoint.lng} anchor="bottom"><button type="button" onClick={(event) => { event.stopPropagation(); removeWaypoint(index); }} className="relative flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-amber-500 text-2xl shadow-lg" title={`Waypoint ${index + 1}. Tap to remove.`}><span aria-hidden="true">🚩</span><span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-900 px-1 text-[10px] font-bold text-white">{index + 1}</span></button></Marker>)}
          </Map>
        ) : <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-slate-600"><p>Mapbox public token is missing from this Production deployment.</p><p className="text-xs">Expected a browser-safe token beginning with pk.</p></div>}
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold shadow">+{viewFeet.toLocaleString()} ft</div>
        {token && !mapLoaded ? <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold shadow">Loading Mapbox…</div> : null}
      </div>

      <section className="rounded-xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Route points</h3><p className="text-sm text-slate-600">Start plus {waypoints.length} waypoint{waypoints.length === 1 ? '' : 's'}. The final segment returns to Start automatically.</p></div><button type="button" disabled={!waypoints.length} onClick={() => removeWaypoint(waypoints.length - 1)} className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-40">Undo last waypoint</button></div>
        {waypoints.length ? <ol className="mt-3 grid gap-2 text-sm sm:grid-cols-2">{waypoints.map((waypoint, index) => <li key={`${waypoint.lat}-${waypoint.lng}-list`} className="rounded-lg bg-slate-50 px-3 py-2"><strong>🚩 {index + 1}</strong> · {waypoint.lat.toFixed(5)}, {waypoint.lng.toFixed(5)}</li>)}</ol> : null}
      </section>

      <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-2 text-sm font-medium">Route name<input value={routeName} onChange={(event) => patchWalkPlanner({ routeName: event.target.value })} className="rounded-lg border px-3 py-3 text-base" /></label><label className="grid gap-2 text-sm font-medium">Random loop fallback: {apexMiles.toFixed(1)} miles<input type="range" min="0.1" max="5" step="0.1" value={apexMiles} onChange={(event) => patchWalkPlanner({ apexMiles: Number(event.target.value) })} /></label></div>
      {routingError ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700" role="alert">{routingError}</p> : null}
      {routeSteps.length ? <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-700"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">Street route</p><p>{distanceMiles?.toFixed(2)} mi · {durationMinutes} min</p></div><ol className="mt-2 list-decimal space-y-1 pl-5">{routeSteps.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ol></div> : null}
      <div><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Favorite routes</h3><p className="text-xs text-slate-500">Map token cached this session: {tokenCachedAt ? new Date(tokenCachedAt).toLocaleTimeString() : 'not yet'}</p></div><div className="mt-3 grid gap-2">{favorites.length === 0 ? <p className="text-sm text-slate-600">No account favorites saved yet.</p> : favorites.map((favorite) => <div key={favorite.id} className="rounded-xl border p-3"><button type="button" onClick={() => loadFavorite(favorite)} className="w-full text-left"><span className="block font-medium">{favorite.name}</span><span className="block text-sm text-slate-500">{favorite.distanceMiles ? `${favorite.distanceMiles.toFixed(2)} mi` : 'Distance unavailable'}{favorite.durationMinutes ? ` · ${favorite.durationMinutes} min` : ''}</span></button><button type="button" onClick={() => deleteFavorite(favorite.id)} className="mt-2 text-xs font-medium text-red-700 underline">Remove favorite</button></div>)}</div></div>
    </section>
  );
}
