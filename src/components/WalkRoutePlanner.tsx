'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Point = { x: number; y: number };
type Coordinate = { lat: number; lng: number };
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

const EARTH_RADIUS_MILES = 3958.8;
const DEFAULT_CENTER: Coordinate = { lat: 40.685743, lng: -73.941329 };
const MAP_SIZE = 640;
const FEET_PER_MILE = 5280;
const DEFAULT_VIEW_FEET = 500;
const ZOOM_STEP_FEET = 20;
const MIN_VIEW_FEET = 40;
const MAX_VIEW_FEET = 5 * FEET_PER_MILE;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeFeet(value: number) {
  return Math.round(clamp(value, MIN_VIEW_FEET, MAX_VIEW_FEET) / ZOOM_STEP_FEET) * ZOOM_STEP_FEET;
}

function viewMiles(viewFeet: number) {
  return viewFeet / FEET_PER_MILE;
}

function mapZoomFromFeet(viewFeet: number) {
  if (viewFeet <= 100) return 18.8;
  if (viewFeet <= 250) return 17.7;
  if (viewFeet <= 500) return 16.7;
  if (viewFeet <= 1000) return 15.7;
  if (viewFeet <= 2640) return 14.3;
  if (viewFeet <= 5280) return 13.2;
  if (viewFeet <= 13200) return 12;
  return 11;
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

function drawPath(points: Point[]) {
  return points
    .map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ');
}

function coordinateToPoint(coordinate: Coordinate, center: Coordinate, radiusMiles: number) {
  const milesPerLatitude = 69;
  const milesPerLongitude = 69 * Math.cos(center.lat * Math.PI / 180);
  return {
    x: MAP_SIZE / 2 + ((coordinate.lng - center.lng) * milesPerLongitude / radiusMiles) * (MAP_SIZE / 2),
    y: MAP_SIZE / 2 - ((coordinate.lat - center.lat) * milesPerLatitude / radiusMiles) * (MAP_SIZE / 2)
  };
}

function pointToCoordinate(point: Point, center: Coordinate, radiusMiles: number): Coordinate {
  const milesPerLatitude = 69;
  const milesPerLongitude = 69 * Math.cos(center.lat * Math.PI / 180);
  const lng = center.lng + (((point.x - MAP_SIZE / 2) / (MAP_SIZE / 2)) * radiusMiles) / milesPerLongitude;
  const lat = center.lat - (((point.y - MAP_SIZE / 2) / (MAP_SIZE / 2)) * radiusMiles) / milesPerLatitude;
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}

function pinLabel(index: number) {
  return index === 0 ? 'Start' : 'Apex';
}

function MapFallback({ viewFeet }: { viewFeet: number }) {
  const blockSize = viewFeet <= 500 ? 32 : viewFeet <= 1000 ? 42 : viewFeet <= 5280 ? 56 : 72;
  return (
    <div className="absolute inset-0 overflow-hidden bg-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(14,165,233,.22),transparent_24%),radial-gradient(circle_at_78%_28%,rgba(34,197,94,.18),transparent_22%),radial-gradient(circle_at_56%_78%,rgba(99,102,241,.16),transparent_26%)]" />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'linear-gradient(90deg,rgba(15,23,42,.10) 1px,transparent 1px),linear-gradient(rgba(15,23,42,.10) 1px,transparent 1px)',
          backgroundSize: `${blockSize}px ${blockSize}px`
        }}
      />
    </div>
  );
}

export default function WalkRoutePlanner() {
  const mapLayerRef = useRef<HTMLDivElement | null>(null);
  const [center, setCenter] = useState<Coordinate>(DEFAULT_CENTER);
  const [start, setStart] = useState<Coordinate | null>(DEFAULT_CENTER);
  const [apex, setApex] = useState<Coordinate | null>(null);
  const [status, setStatus] = useState('Set the start point, select an apex, then generate a street-routed walking loop.');
  const [drawnArea, setDrawnArea] = useState<Point[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [mode, setMode] = useState<'select' | 'draw'>('select');
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

  useEffect(() => {
    let active = true;

    async function loadFavorites() {
      try {
        const response = await fetch('/api/walk-routes/favorites', { cache: 'no-store' });
        const payload = await response.json() as { favorites?: SavedRoute[] };
        if (active && response.ok) setFavorites(payload.favorites ?? []);
      } catch {
        if (active) setStatus('Favorite routes could not be loaded. Route planning remains available.');
      }
    }

    void loadFavorites();
    return () => { active = false; };
  }, []);

  const radiusMiles = viewMiles(viewFeet);
  const mapUrl = useMemo(() => {
    const params = new URLSearchParams({
      lat: String(center.lat),
      lng: String(center.lng),
      zoom: String(mapZoomFromFeet(viewFeet)),
      width: String(MAP_SIZE),
      height: String(MAP_SIZE)
    });
    return `/api/maps/static?${params.toString()}`;
  }, [center, viewFeet]);

  function resetRoute() {
    setRoute([]);
    setRouteSteps([]);
    setDistanceMiles(null);
    setDurationMinutes(null);
  }

  function setView(value: number) {
    setViewFeet(normalizeFeet(value));
  }

  function locate() {
    if (!navigator.geolocation) {
      setStatus('Location services are unavailable. Select the map points manually.');
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
        setView(DEFAULT_VIEW_FEET);
        setStatus('Current location set. Tap the apex or turnaround point.');
      },
      () => setStatus('Location permission was denied. Select the map points manually.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  function pointerPoint(event: React.PointerEvent<HTMLDivElement>) {
    const bounds = mapLayerRef.current?.getBoundingClientRect();
    if (!bounds) return null;
    return {
      x: clamp(((event.clientX - bounds.left) / bounds.width) * MAP_SIZE, 0, MAP_SIZE),
      y: clamp(((event.clientY - bounds.top) / bounds.height) * MAP_SIZE, 0, MAP_SIZE)
    };
  }

  function pointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const point = pointerPoint(event);
    if (!point) return;

    if (mode === 'draw') {
      setDrawnArea([point]);
      setDrawing(true);
      return;
    }

    const coordinate = pointToCoordinate(point, center, radiusMiles);
    if (!start) {
      setStart(coordinate);
      setStatus('Start point selected. Tap the apex point.');
      return;
    }

    setApex(coordinate);
    resetRoute();
    setStatus('Apex selected. Generate the walking-street route.');
  }

  function pointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const point = pointerPoint(event);
    if (mode === 'draw' && drawing && point) {
      setDrawnArea((current) => [...current, point].slice(-180));
    }
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
    area: drawnArea,
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
    const data = JSON.parse(saved.routeJson);
    setRouteName(data.name || saved.name);
    setCenter(data.center || DEFAULT_CENTER);
    setApexMiles(data.apexMiles || 1);
    setStart(data.start || DEFAULT_CENTER);
    setApex(data.apexPoint || null);
    setDrawnArea(data.area || []);
    setRoute(data.route || []);
    setRouteSteps(data.routeSteps || []);
    setDistanceMiles(data.distanceMiles ?? saved.distanceMiles ?? null);
    setDurationMinutes(data.durationMinutes ?? saved.durationMinutes ?? null);
    setView(data.viewFeet || DEFAULT_VIEW_FEET);
    setStatus(`Loaded favorite route: ${saved.name}.`);
  }

  const pins = [start, apex].filter(Boolean) as Coordinate[];
  const routePath = route.length > 1
    ? route.map((coordinate, index) => {
        const point = coordinateToPoint(coordinate, center, radiusMiles);
        return `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
      }).join(' ')
    : '';

  return (
    <section className="grid gap-5 rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
      <div>
        <h2 className="text-xl font-semibold">Walk route planner</h2>
        <p className="mt-1 text-sm text-slate-600">Generated routes follow walking streets and paths. Favorites are stored with the signed-in account.</p>
      </div>

      <input type="hidden" name="routeName" value={routeName} />
      <input type="hidden" name="routeJson" value={routeJson} />

      <div className="grid gap-3 sm:grid-cols-3">
        <button type="button" onClick={locate} className="rounded-lg bg-slate-900 px-4 py-3 font-medium text-white">Use current location</button>
        <button type="button" onClick={() => setMode(mode === 'select' ? 'draw' : 'select')} className="rounded-lg border px-4 py-3 font-medium">Mode: {mode === 'select' ? 'select points' : 'draw area'}</button>
        <button type="button" onClick={() => { setDrawnArea([]); setApex(null); resetRoute(); }} className="rounded-lg border px-4 py-3 font-medium">Clear</button>
      </div>

      <div className="grid gap-3 rounded-xl border bg-slate-50 p-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setView(viewFeet - ZOOM_STEP_FEET)} className="h-11 w-11 rounded-lg border bg-white text-xl font-bold">+</button>
          <input aria-label="Map view scale in feet" type="range" min={MIN_VIEW_FEET} max={MAX_VIEW_FEET} step={ZOOM_STEP_FEET} value={viewFeet} onChange={(event) => setView(Number(event.target.value))} className="min-w-0 flex-1" />
          <button type="button" onClick={() => setView(viewFeet + ZOOM_STEP_FEET)} className="h-11 w-11 rounded-lg border bg-white text-xl font-bold">−</button>
        </div>
        <p className="text-xs font-semibold text-slate-600">View scale: +{viewFeet.toLocaleString()} ft · step: 20 ft · max: 5 mi</p>
      </div>

      <p className="text-sm text-slate-600">{status}</p>

      <div className="relative h-[420px] overflow-hidden rounded-2xl border bg-slate-100">
        <div
          ref={mapLayerRef}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={() => setDrawing(false)}
          onPointerCancel={() => setDrawing(false)}
          className="relative h-full w-full"
          style={{ touchAction: mode === 'draw' ? 'none' : 'pan-x pan-y' }}
        >
          <MapFallback viewFeet={viewFeet} />
          <img src={mapUrl} alt="Street map centered on the selected walk area" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold shadow">+{viewFeet.toLocaleString()} ft</div>
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 640 640" preserveAspectRatio="none">
            <circle cx="320" cy="320" r="310" fill="rgba(14,165,233,.08)" stroke="rgba(2,132,199,.55)" strokeWidth="5" />
            {drawnArea.length > 1 ? <path d={drawPath(drawnArea)} fill="rgba(14,165,233,.12)" stroke="rgba(15,23,42,.75)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /> : null}
            {routePath ? <path d={routePath} fill="none" stroke="rgba(2,132,199,.95)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" /> : null}
            {pins.map((coordinate, index) => {
              const point = coordinateToPoint(coordinate, center, radiusMiles);
              return <g key={index}><circle cx={point.x} cy={point.y} r="16" fill="#0f172a" /><text x={point.x + 20} y={point.y + 5} fill="#0f172a" fontSize="24" fontWeight="700">{pinLabel(index)}</text></g>;
            })}
          </svg>
        </div>
      </div>

      <label className="grid gap-2 text-sm font-medium">Route name<input value={routeName} onChange={(event) => setRouteName(event.target.value)} className="rounded-lg border px-3 py-3 text-base" /></label>
      <label className="grid gap-2 text-sm font-medium">Apex distance fallback: {apexMiles.toFixed(1)} miles<input type="range" min="0.1" max="5" step="0.1" value={apexMiles} onChange={(event) => setApexMiles(Number(event.target.value))} /></label>

      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" disabled={routing} onClick={generateStreetRoute} className="rounded-lg bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-50">{routing ? 'Routing streets…' : 'Generate street route'}</button>
        <button type="button" disabled={savingFavorite} onClick={saveFavorite} className="rounded-lg border px-4 py-3 font-medium disabled:opacity-50">{savingFavorite ? 'Saving…' : 'Save favorite route'}</button>
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
