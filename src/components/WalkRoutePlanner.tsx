'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Map, {
  GeolocateControl,
  Layer,
  Marker,
  NavigationControl,
  Source,
  type MapRef
} from 'react-map-gl/mapbox';

type Coordinate = { lat: number; lng: number };
type MapMode = 'pan' | 'start' | 'apex';
type SavedRoute = {
  id: string;
  name: string;
  createdAt: string;
  routeJson: string;
  distanceMiles: number | null;
  durationMinutes: number | null;
};
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
type Props = { initialToken: string };

const EARTH_RADIUS_MILES = 3958.8;
const DEFAULT_CENTER: Coordinate = { lat: 40.685743, lng: -73.941329 };
const FEET_PER_MILE = 5280;
const DEFAULT_VIEW_FEET = 500;
const ZOOM_STEP_FEET = 20;
const MIN_VIEW_FEET = 40;
const MAX_VIEW_FEET = 5 * FEET_PER_MILE;
const ESTIMATED_MAP_WIDTH_PX = 640;

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

export default function WalkRoutePlanner({ initialToken }: Props) {
  const mapRef = useRef<MapRef | null>(null);
  const [token, setToken] = useState(initialToken);
  const [center, setCenter] = useState<Coordinate>(DEFAULT_CENTER);
  const [start, setStart] = useState<Coordinate | null>(DEFAULT_CENTER);
  const [apex, setApex] = useState<Coordinate | null>(null);
  const [mode, setMode] = useState<MapMode>('pan');
  const [status, setStatus] = useState(
    initialToken
      ? 'Mapbox token loaded from the production deployment.'
      : 'Mapbox public token is not available in this deployment.'
  );
  const [apexMiles, setApexMiles] = useState(1);
  const [routeName, setRouteName] = useState('Neighborhood walk');
  const [route, setRoute] = useState<Coordinate[]>([]);
  const [routeSteps, setRouteSteps] = useState<string[]>([]);
  const [distanceMiles, setDistanceMiles] = useState<number | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [favorites, setFavorites] = useState<SavedRoute[]>([]);
  const [viewFeet, setViewFeet] = useState(DEFAULT_VIEW_FEET);
  const [routing, setRouting] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    async function initialize() {
      const requests: Promise<Response>[] = [
        fetch('/api/walk-routes/favorites', { cache: 'no-store' })
      ];
      if (!initialToken) requests.push(fetch(`/api/maps/config?ts=${Date.now()}`, { cache: 'no-store' }));

      try {
        const responses = await Promise.all(requests);
        const favoritePayload = await responses[0].json() as { favorites?: SavedRoute[] };
        if (!active) return;
        if (responses[0].ok) setFavorites(favoritePayload.favorites ?? []);

        if (!initialToken && responses[1]) {
          const config = await responses[1].json() as { token?: string; error?: string };
          if (responses[1].ok && config.token) {
            setToken(config.token);
            setStatus('Mapbox token loaded from the runtime configuration.');
          } else {
            setStatus(config.error || 'Mapbox token unavailable.');
          }
        }
      } catch {
        if (active && !initialToken) setStatus('Map configuration could not be loaded.');
      }
    }

    void initialize();
    return () => { active = false; };
  }, [initialToken]);

  const routeFeature = useMemo(() => ({
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: route.map((point) => [point.lng, point.lat])
    }
  }), [route]);

  const boundaryFeature = useMemo(() => circleFeature(start || center, 5), [start, center]);

  function resetRoute() {
    setRoute([]);
    setRouteSteps([]);
    setDistanceMiles(null);
    setDurationMinutes(null);
  }

  function applyViewFeet(value: number) {
    const next = normalizeFeet(value);
    setViewFeet(next);
    const map = mapRef.current;
    const current = map?.getCenter();
    const latitude = current?.lat ?? center.lat;
    map?.flyTo({
      center: current ? [current.lng, current.lat] : [center.lng, center.lat],
      zoom: zoomForFeet(next, latitude),
      duration: 250
    });
  }

  function locate() {
    if (!navigator.geolocation) {
      setStatus('Location services are unavailable. Select a start point on the map.');
      return;
    }

    setStatus('Requesting current location…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const current = {
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6))
        };
        setCenter(current);
        setStart(current);
        setApex(null);
        resetRoute();
        setViewFeet(DEFAULT_VIEW_FEET);
        mapRef.current?.flyTo({
          center: [current.lng, current.lat],
          zoom: zoomForFeet(DEFAULT_VIEW_FEET, current.lat),
          duration: 900
        });
        setStatus(`Current location set within approximately ${Math.round(position.coords.accuracy)} ft.`);
      },
      () => setStatus('Location permission was denied. Select a start point on the map.'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  }

  function selectPoint(event: { lngLat: { lat: number; lng: number } }) {
    if (mode === 'pan') return;

    const coordinate = {
      lat: Number(event.lngLat.lat.toFixed(6)),
      lng: Number(event.lngLat.lng.toFixed(6))
    };

    if (mode === 'start') {
      setStart(coordinate);
      setCenter(coordinate);
      setApex(null);
      resetRoute();
      setMode('pan');
      setStatus('Start point selected. Choose Set apex to place the turnaround point.');
      return;
    }

    setApex(coordinate);
    resetRoute();
    setMode('pan');
    setStatus('Apex selected. Generate the walking-street route.');
  }

  async function generateStreetRoute() {
    const base = start || center;
    const outboundBearing = apex ? bearingBetween(base, apex) : Math.random() * 360;
    const selectedApex = apex || destination(base, apexMiles, outboundBearing);
    const returnWaypoint = destination(
      selectedApex,
      Math.max(0.05, apexMiles * 0.3),
      outboundBearing + 135 + Math.random() * 90
    );

    setRouting(true);
    setStatus('Routing the loop along walkable streets and paths…');

    try {
      const response = await fetch('/api/maps/directions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinates: [base, selectedApex, returnWaypoint, base] })
      });
      const payload = await response.json() as DirectionsPayload & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Street routing failed.');

      setApex(selectedApex);
      setRoute(payload.geometry);
      setRouteSteps(payload.steps.map((step) => `${step.instruction}${step.distanceFeet ? ` · ${step.distanceFeet.toLocaleString()} ft` : ''}`));
      setDistanceMiles(payload.distanceMiles);
      setDurationMinutes(payload.durationMinutes);
      setStatus('Street-routed walking loop generated.');

      const bounds = boundsForRoute(payload.geometry);
      if (bounds) mapRef.current?.fitBounds(bounds, { padding: 55, duration: 900 });
    } catch (error) {
      resetRoute();
      setStatus(error instanceof Error ? error.message : 'Street routing failed.');
    } finally {
      setRouting(false);
    }
  }

  const routeJson = JSON.stringify({
    name: routeName,
    routeEngine: 'mapbox/directions-walking',
    center,
    start,
    apexPoint: apex,
    apexMiles,
    route,
    routeSteps,
    distanceMiles,
    durationMinutes,
    viewFeet
  });

  async function saveFavorite() {
    if (!route.length) {
      setStatus('Generate a street route before saving it.');
      return;
    }

    setSavingFavorite(true);
    setStatus('Saving favorite route to your account…');

    try {
      const response = await fetch('/api/walk-routes/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routeJson })
      });
      const payload = await response.json() as { favorite?: SavedRoute; error?: string };
      if (!response.ok || !payload.favorite) throw new Error(payload.error || 'Favorite route could not be saved.');
      setFavorites((current) => [payload.favorite as SavedRoute, ...current].slice(0, 20));
      setStatus('Favorite route saved to your account.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Favorite route could not be saved.');
    } finally {
      setSavingFavorite(false);
    }
  }

  async function deleteFavorite(id: string) {
    try {
      const response = await fetch('/api/walk-routes/favorites', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (!response.ok) throw new Error('Favorite route could not be removed.');
      setFavorites((current) => current.filter((favorite) => favorite.id !== id));
      setStatus('Favorite route removed.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Favorite route could not be removed.');
    }
  }

  function loadFavorite(saved: SavedRoute) {
    const data = JSON.parse(saved.routeJson) as {
      name?: string;
      center?: Coordinate;
      start?: Coordinate;
      apexPoint?: Coordinate;
      apexMiles?: number;
      route?: Coordinate[];
      routeSteps?: string[];
      distanceMiles?: number;
      durationMinutes?: number;
      viewFeet?: number;
    };

    const loadedRoute = data.route ?? [];
    const loadedCenter = data.center ?? data.start ?? DEFAULT_CENTER;
    setRouteName(data.name || saved.name);
    setCenter(loadedCenter);
    setApexMiles(data.apexMiles || 1);
    setStart(data.start || loadedCenter);
    setApex(data.apexPoint || null);
    setRoute(loadedRoute);
    setRouteSteps(data.routeSteps || []);
    setDistanceMiles(data.distanceMiles ?? saved.distanceMiles ?? null);
    setDurationMinutes(data.durationMinutes ?? saved.durationMinutes ?? null);
    setViewFeet(normalizeFeet(data.viewFeet || DEFAULT_VIEW_FEET));
    setStatus(`Loaded favorite route: ${saved.name}.`);

    const bounds = boundsForRoute(loadedRoute);
    if (bounds) mapRef.current?.fitBounds(bounds, { padding: 55, duration: 800 });
    else mapRef.current?.flyTo({
      center: [loadedCenter.lng, loadedCenter.lat],
      zoom: zoomForFeet(data.viewFeet || DEFAULT_VIEW_FEET, loadedCenter.lat),
      duration: 700
    });
  }

  return (
    <section className="grid gap-5 rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
      <div>
        <h2 className="text-xl font-semibold">Interactive walk route planner</h2>
        <p className="mt-1 text-sm text-slate-600">Drag, pinch, double-tap, and zoom using standard mobile map gestures. Route geometry follows walking streets and paths.</p>
      </div>

      <input type="hidden" name="routeName" value={routeName} />
      <input type="hidden" name="routeJson" value={routeJson} />

      <div className="grid gap-2 sm:grid-cols-4">
        <button type="button" onClick={locate} className="rounded-lg bg-slate-900 px-4 py-3 font-medium text-white">Current location</button>
        <button type="button" onClick={() => setMode('pan')} className={`rounded-lg border px-4 py-3 font-medium ${mode === 'pan' ? 'bg-slate-100' : ''}`}>Pan map</button>
        <button type="button" onClick={() => setMode('start')} className={`rounded-lg border px-4 py-3 font-medium ${mode === 'start' ? 'bg-slate-100' : ''}`}>Set start</button>
        <button type="button" onClick={() => setMode('apex')} className={`rounded-lg border px-4 py-3 font-medium ${mode === 'apex' ? 'bg-slate-100' : ''}`}>Set apex</button>
      </div>

      <div className="grid gap-3 rounded-xl border bg-slate-50 p-3">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Zoom in by 20 feet" onClick={() => applyViewFeet(viewFeet - ZOOM_STEP_FEET)} className="h-11 w-11 rounded-lg border bg-white text-xl font-bold">+</button>
          <input aria-label="Map view radius in feet" type="range" min={MIN_VIEW_FEET} max={MAX_VIEW_FEET} step={ZOOM_STEP_FEET} value={viewFeet} onChange={(event) => applyViewFeet(Number(event.target.value))} className="min-w-0 flex-1" />
          <button type="button" aria-label="Zoom out by 20 feet" onClick={() => applyViewFeet(viewFeet + ZOOM_STEP_FEET)} className="h-11 w-11 rounded-lg border bg-white text-xl font-bold">−</button>
        </div>
        <p className="text-xs font-semibold text-slate-600">View radius: +{viewFeet.toLocaleString()} ft · controls change by exactly 20 ft</p>
      </div>

      <p className="text-sm text-slate-600" role="status">{status}</p>

      <div className="relative h-[460px] overflow-hidden rounded-2xl border bg-slate-100">
        {token ? (
          <Map
            ref={mapRef}
            mapboxAccessToken={token}
            initialViewState={{
              latitude: center.lat,
              longitude: center.lng,
              zoom: zoomForFeet(DEFAULT_VIEW_FEET, center.lat)
            }}
            mapStyle="mapbox://styles/mapbox/streets-v12"
            dragRotate={false}
            touchPitch={false}
            cursor={mode === 'pan' ? 'grab' : 'crosshair'}
            onClick={selectPoint}
            onLoad={() => {
              setMapLoaded(true);
              setStatus('Map loaded. Pan, pinch, or choose route points.');
            }}
            onError={(event) => {
              setMapLoaded(false);
              setStatus(`Mapbox failed to render: ${event.error?.message || 'unknown map error'}`);
            }}
            onMoveEnd={(event) => {
              const nextCenter = event.target.getCenter();
              setCenter({ lat: nextCenter.lat, lng: nextCenter.lng });
              setViewFeet(feetForZoom(event.target.getZoom(), nextCenter.lat));
            }}
          >
            <NavigationControl position="top-right" showCompass={false} />
            <GeolocateControl position="top-right" trackUserLocation showUserHeading={false} />

            <Source id="walk-boundary" type="geojson" data={boundaryFeature}>
              <Layer id="walk-boundary-fill" type="fill" paint={{ 'fill-color': '#0ea5e9', 'fill-opacity': 0.04 }} />
              <Layer id="walk-boundary-line" type="line" paint={{ 'line-color': '#0284c7', 'line-width': 2, 'line-opacity': 0.55 }} />
            </Source>

            {route.length > 1 ? (
              <Source id="walk-route" type="geojson" data={routeFeature}>
                <Layer id="walk-route-line" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': '#0284c7', 'line-width': 7, 'line-opacity': 0.95 }} />
              </Source>
            ) : null}

            {start ? <Marker latitude={start.lat} longitude={start.lng} anchor="bottom"><div className="rounded-xl border-2 border-white bg-slate-900 px-3 py-2 text-xs font-bold text-white shadow-lg">Start</div></Marker> : null}
            {apex ? <Marker latitude={apex.lat} longitude={apex.lng} anchor="bottom"><div className="rounded-xl border-2 border-white bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 shadow-lg">Apex</div></Marker> : null}
          </Map>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-slate-600">
            <p>Mapbox public token is missing from this Production deployment.</p>
            <p className="text-xs">Expected a Vercel environment variable containing a token that begins with pk.</p>
          </div>
        )}

        <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold shadow">+{viewFeet.toLocaleString()} ft</div>
        {token && !mapLoaded ? <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold shadow">Loading Mapbox…</div> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">Route name<input value={routeName} onChange={(event) => setRouteName(event.target.value)} className="rounded-lg border px-3 py-3 text-base" /></label>
        <label className="grid gap-2 text-sm font-medium">Random apex fallback: {apexMiles.toFixed(1)} miles<input type="range" min="0.1" max="5" step="0.1" value={apexMiles} onChange={(event) => setApexMiles(Number(event.target.value))} /></label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <button type="button" disabled={routing} onClick={generateStreetRoute} className="rounded-lg bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-50">{routing ? 'Routing streets…' : 'Generate street route'}</button>
        <button type="button" disabled={savingFavorite} onClick={saveFavorite} className="rounded-lg border px-4 py-3 font-medium disabled:opacity-50">{savingFavorite ? 'Saving…' : 'Save favorite'}</button>
        <button type="button" onClick={() => { setApex(null); resetRoute(); setMode('pan'); }} className="rounded-lg border px-4 py-3 font-medium">Clear route</button>
      </div>

      {routeSteps.length ? (
        <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">Street route</p><p>{distanceMiles?.toFixed(2)} mi · {durationMinutes} min</p></div>
          <ol className="mt-2 list-decimal space-y-1 pl-5">{routeSteps.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ol>
        </div>
      ) : null}

      <div>
        <h3 className="font-semibold">Favorite routes</h3>
        <div className="mt-3 grid gap-2">
          {favorites.length === 0 ? <p className="text-sm text-slate-600">No account favorites saved yet.</p> : favorites.map((favorite) => (
            <div key={favorite.id} className="rounded-xl border p-3">
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
