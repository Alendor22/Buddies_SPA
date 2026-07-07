'use client';

import { useEffect, useRef, useState } from 'react';

type Pt = { x: number; y: number };
type Geo = { lat: number; lng: number };
type Saved = { id: string; name: string; apexMiles: number; createdAt: string; routeJson: string };
type DirectionsPayload = {
  geometry: Geo[];
  steps: { instruction: string; street: string | null; distanceFeet: number; durationSeconds: number }[];
  distanceMiles: number;
  durationMinutes: number;
};

const KEY = 'buddies_walk_favorites_v24';
const EARTH_RADIUS_MILES = 3958.8;
const DEFAULT_CENTER: Geo = { lat: 40.685743, lng: -73.941329 };
const MAP_SIZE = 640;
const FEET_PER_MILE = 5280;
const DEFAULT_VIEW_FEET = 500;
const ZOOM_STEP_FEET = 20;
const MIN_VIEW_FEET = 40;
const MAX_VIEW_FEET = 5 * FEET_PER_MILE;

function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function normalizeFeet(value: number) { return Math.round(clamp(value, MIN_VIEW_FEET, MAX_VIEW_FEET) / ZOOM_STEP_FEET) * ZOOM_STEP_FEET; }
function viewMiles(viewFeet: number) { return viewFeet / FEET_PER_MILE; }
function mapboxZoomFromFeet(viewFeet: number) { if (viewFeet <= 100) return 18.8; if (viewFeet <= 250) return 17.7; if (viewFeet <= 500) return 16.7; if (viewFeet <= 1000) return 15.7; if (viewFeet <= 2640) return 14.3; if (viewFeet <= 5280) return 13.2; if (viewFeet <= 13200) return 12.0; return 11.0; }

function destination(start: Geo, miles: number, bearingDegrees: number): Geo {
  const bearing = bearingDegrees * Math.PI / 180;
  const lat1 = start.lat * Math.PI / 180;
  const lng1 = start.lng * Math.PI / 180;
  const distance = miles / EARTH_RADIUS_MILES;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(distance) + Math.cos(lat1) * Math.sin(distance) * Math.cos(bearing));
  const lng2 = lng1 + Math.atan2(Math.sin(bearing) * Math.sin(distance) * Math.cos(lat1), Math.cos(distance) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: Number((lat2 * 180 / Math.PI).toFixed(6)), lng: Number((lng2 * 180 / Math.PI).toFixed(6)) };
}

function bearingBetween(a: Geo, b: Geo) {
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const deltaLng = (b.lng - a.lng) * Math.PI / 180;
  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

function drawPath(points: Pt[]) { return points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' '); }
function geoToPoint(geo: Geo, center: Geo, radiusMiles: number) { const milesPerLatitude = 69; const milesPerLongitude = 69 * Math.cos(center.lat * Math.PI / 180); return { x: MAP_SIZE / 2 + ((geo.lng - center.lng) * milesPerLongitude / radiusMiles) * (MAP_SIZE / 2), y: MAP_SIZE / 2 - ((geo.lat - center.lat) * milesPerLatitude / radiusMiles) * (MAP_SIZE / 2) }; }
function pointToGeo(point: Pt, center: Geo, radiusMiles: number): Geo { const milesPerLatitude = 69; const milesPerLongitude = 69 * Math.cos(center.lat * Math.PI / 180); const lng = center.lng + (((point.x - MAP_SIZE / 2) / (MAP_SIZE / 2)) * radiusMiles) / milesPerLongitude; const lat = center.lat - (((point.y - MAP_SIZE / 2) / (MAP_SIZE / 2)) * radiusMiles) / milesPerLatitude; return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) }; }
function pinLabel(index: number) { return index === 0 ? 'Start' : 'Apex'; }

function AnimatedMapBase({ viewFeet }: { viewFeet: number }) {
  const block = viewFeet <= 500 ? 32 : viewFeet <= 1000 ? 42 : viewFeet <= 5280 ? 56 : 72;
  return <div className="absolute inset-0 overflow-hidden bg-slate-100"><div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(14,165,233,.22),transparent_24%),radial-gradient(circle_at_78%_28%,rgba(34,197,94,.18),transparent_22%),radial-gradient(circle_at_56%_78%,rgba(99,102,241,.16),transparent_26%)]" /><div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(90deg,rgba(15,23,42,.10) 1px,transparent 1px),linear-gradient(rgba(15,23,42,.10) 1px,transparent 1px)', backgroundSize: `${block}px ${block}px` }} /><div className="absolute -left-20 top-16 h-24 w-[150%] rotate-[-12deg] rounded-full bg-white/70" /><div className="absolute -left-16 top-56 h-20 w-[140%] rotate-[18deg] rounded-full bg-white/65" /><div className="absolute left-24 top-0 h-full w-16 rotate-[8deg] rounded-full bg-white/55" /><div className="absolute left-0 top-0 h-full w-full animate-pulse bg-gradient-to-br from-transparent via-white/20 to-transparent" /></div>;
}

export default function WalkRoutePlanner() {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const [center, setCenter] = useState<Geo>(DEFAULT_CENTER);
  const [start, setStart] = useState<Geo | null>(DEFAULT_CENTER);
  const [apexPoint, setApexPoint] = useState<Geo | null>(null);
  const [status, setStatus] = useState('Start at current location, select an apex, then generate a street-routed walking loop.');
  const [area, setArea] = useState<Pt[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [mode, setMode] = useState<'select' | 'draw'>('select');
  const [apexMiles, setApexMiles] = useState(1);
  const [routeName, setRouteName] = useState('Neighborhood walk');
  const [route, setRoute] = useState<Geo[]>([]);
  const [routeSteps, setRouteSteps] = useState<string[]>([]);
  const [distanceMiles, setDistanceMiles] = useState<number | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [favorites, setFavorites] = useState<Saved[]>([]);
  const [mapFailed, setMapFailed] = useState(false);
  const [viewFeet, setViewFeet] = useState(DEFAULT_VIEW_FEET);
  const [routing, setRouting] = useState(false);

  useEffect(() => { try { setFavorites(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { setFavorites([]); } }, []);

  const radiusMiles = viewMiles(viewFeet);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
  const mapUrl = token && !mapFailed ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${center.lng},${center.lat},${mapboxZoomFromFeet(viewFeet)},0/${MAP_SIZE}x${MAP_SIZE}?access_token=${token}` : '';

  function resetRoute() { setRoute([]); setRouteSteps([]); setDistanceMiles(null); setDurationMinutes(null); }
  function setView(value: number) { setViewFeet(normalizeFeet(value)); }
  function zoomIn() { setView(viewFeet - ZOOM_STEP_FEET); }
  function zoomOut() { setView(viewFeet + ZOOM_STEP_FEET); }

  function locate() {
    if (!navigator.geolocation) return setStatus('Location is unavailable in this browser.');
    setStatus('Requesting location...');
    navigator.geolocation.getCurrentPosition((position) => {
      const current = { lat: Number(position.coords.latitude.toFixed(6)), lng: Number(position.coords.longitude.toFixed(6)) };
      setCenter(current); setStart(current); setApexPoint(null); resetRoute(); setMapFailed(false); setView(DEFAULT_VIEW_FEET);
      setStatus('Current location set. Tap the apex/turnaround point next.');
    }, () => setStatus('Location permission denied. Select start and apex points manually.'), { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  }

  function pointerPoint(event: React.PointerEvent<HTMLDivElement>) {
    const box = layerRef.current?.getBoundingClientRect();
    if (!box) return null;
    return { x: clamp(((event.clientX - box.left) / box.width) * MAP_SIZE, 0, MAP_SIZE), y: clamp(((event.clientY - box.top) / box.height) * MAP_SIZE, 0, MAP_SIZE) };
  }

  function pointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const point = pointerPoint(event);
    if (!point) return;
    if (mode === 'draw') { setArea([point]); setDrawing(true); return; }
    const geo = pointToGeo(point, center, radiusMiles);
    if (!start) { setStart(geo); setStatus('Start point selected. Tap the apex point.'); }
    else { setApexPoint(geo); resetRoute(); setStatus('Apex selected. Generate the real walking-street route.'); }
  }

  function pointerMove(event: React.PointerEvent<HTMLDivElement>) { const point = pointerPoint(event); if (mode === 'draw' && drawing && point) setArea((current) => [...current, point].slice(-180)); }
  function pointerUp() { setDrawing(false); }

  async function suggest() {
    const base = start || center;
    const outboundBearing = apexPoint ? bearingBetween(base, apexPoint) : Math.random() * 360;
    const apex = apexPoint || destination(base, apexMiles, outboundBearing);
    const returnWaypoint = destination(apex, Math.max(0.05, apexMiles * 0.3), outboundBearing + 135 + Math.random() * 90);
    setRouting(true);
    setStatus('Routing the loop along walkable streets and paths...');

    try {
      const response = await fetch('/api/maps/directions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinates: [base, apex, returnWaypoint, base] })
      });
      const data = await response.json() as DirectionsPayload & { error?: string };
      if (!response.ok) throw new Error(data.error || 'Street routing failed.');
      setApexPoint(apex);
      setRoute(data.geometry);
      setRouteSteps(data.steps.map((step) => `${step.instruction}${step.distanceFeet ? ` · ${step.distanceFeet.toLocaleString()} ft` : ''}`));
      setDistanceMiles(data.distanceMiles);
      setDurationMinutes(data.durationMinutes);
      setStatus('Street-routed walking loop generated.');
    } catch (error) {
      resetRoute();
      setStatus(error instanceof Error ? error.message : 'Street routing failed.');
    } finally {
      setRouting(false);
    }
  }

  const routeJson = JSON.stringify({ name: routeName, routeEngine: 'mapbox/walking', center, start, apexPoint, apexMiles, area, route, routeSteps, distanceMiles, durationMinutes, viewFeet });

  function saveFavorite() {
    if (!route.length) return setStatus('Generate a street route before saving it.');
    const next = [{ id: String(Date.now()), name: routeName, apexMiles, createdAt: new Date().toISOString(), routeJson }, ...favorites].slice(0, 20);
    setFavorites(next); localStorage.setItem(KEY, JSON.stringify(next)); setStatus('Favorite street route saved on this device.');
  }

  function loadFavorite(saved: Saved) {
    const data = JSON.parse(saved.routeJson);
    setRouteName(data.name || saved.name); setCenter(data.center || DEFAULT_CENTER); setApexMiles(data.apexMiles || saved.apexMiles); setStart(data.start || DEFAULT_CENTER); setApexPoint(data.apexPoint || null); setArea(data.area || []); setRoute(data.route || []); setRouteSteps(data.routeSteps || []); setDistanceMiles(data.distanceMiles ?? null); setDurationMinutes(data.durationMinutes ?? null); setView(data.viewFeet || DEFAULT_VIEW_FEET);
  }

  const pins = [start, apexPoint].filter(Boolean) as Geo[];
  const line = route.length > 1 ? route.map((point, index) => { const mapPoint = geoToPoint(point, center, radiusMiles); return `${index ? 'L' : 'M'} ${mapPoint.x.toFixed(1)} ${mapPoint.y.toFixed(1)}`; }).join(' ') : '';

  return (
    <section className="grid gap-5 rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
      <div><h2 className="text-xl font-semibold">Walk route planner</h2><p className="mt-1 text-sm text-slate-600">The generated line and directions are snapped to real walking streets and paths. No synthetic street names or visible GPS lists are used.</p></div>
      <input type="hidden" name="routeName" value={routeName} /><input type="hidden" name="routeJson" value={routeJson} />
      <div className="grid gap-3 sm:grid-cols-3"><button type="button" onClick={locate} className="rounded-lg bg-slate-900 px-4 py-3 font-medium text-white">Use current location</button><button type="button" onClick={() => setMode(mode === 'select' ? 'draw' : 'select')} className="rounded-lg border px-4 py-3 font-medium">Mode: {mode === 'select' ? 'select points' : 'draw area'}</button><button type="button" onClick={() => { setArea([]); setApexPoint(null); resetRoute(); }} className="rounded-lg border px-4 py-3 font-medium">Clear</button></div>
      <div className="grid gap-3 rounded-xl border bg-slate-50 p-3"><div className="flex items-center gap-3"><button type="button" onClick={zoomIn} className="h-11 w-11 rounded-lg border bg-white text-xl font-bold">+</button><input aria-label="Map view scale in feet" type="range" min={MIN_VIEW_FEET} max={MAX_VIEW_FEET} step={ZOOM_STEP_FEET} value={viewFeet} onChange={(event) => setView(Number(event.target.value))} className="min-w-0 flex-1" /><button type="button" onClick={zoomOut} className="h-11 w-11 rounded-lg border bg-white text-xl font-bold">−</button></div><p className="text-xs font-semibold text-slate-600">View scale: +{viewFeet.toLocaleString()} ft · step: 20 ft · max: 5 mi</p></div>
      <p className="text-sm text-slate-600">{status}</p>
      <div className="relative h-[420px] overflow-auto rounded-2xl border bg-slate-100 touch-pan-x touch-pan-y"><div ref={layerRef} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} className="relative h-full w-full" style={{ touchAction: mode === 'draw' ? 'none' : 'pan-x pan-y' }}><AnimatedMapBase viewFeet={viewFeet} />{mapUrl ? <img src={mapUrl} onError={() => setMapFailed(true)} alt="Street map centered on the selected walk area" className="absolute inset-0 h-full w-full object-cover opacity-95" /> : null}<div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold shadow">+{viewFeet.toLocaleString()} ft</div><svg className="absolute inset-0 h-full w-full" viewBox="0 0 640 640" preserveAspectRatio="none"><circle cx="320" cy="320" r="310" fill="rgba(14,165,233,.08)" stroke="rgba(2,132,199,.55)" strokeWidth="5" />{area.length > 1 ? <path d={drawPath(area)} fill="rgba(14,165,233,.12)" stroke="rgba(15,23,42,.75)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /> : null}{line ? <path d={line} fill="none" stroke="rgba(2,132,199,.95)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" /> : null}{pins.map((point, index) => { const mapPoint = geoToPoint(point, center, radiusMiles); return <g key={index}><circle cx={mapPoint.x} cy={mapPoint.y} r="16" fill="#0f172a" /><text x={mapPoint.x + 20} y={mapPoint.y + 5} fill="#0f172a" fontSize="24" fontWeight="700">{pinLabel(index)}</text></g>; })}</svg></div></div>
      <label className="grid gap-2 text-sm font-medium">Route name<input value={routeName} onChange={(event) => setRouteName(event.target.value)} className="rounded-lg border px-3 py-3 text-base" /></label>
      <label className="grid gap-2 text-sm font-medium">Apex distance fallback: {apexMiles.toFixed(1)} miles<input type="range" min="0.1" max="5" step="0.1" value={apexMiles} onChange={(event) => setApexMiles(Number(event.target.value))} /></label>
      <div className="grid gap-3 sm:grid-cols-2"><button type="button" disabled={routing} onClick={suggest} className="rounded-lg bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-50">{routing ? 'Routing streets...' : 'Generate street route'}</button><button type="button" onClick={saveFavorite} className="rounded-lg border px-4 py-3 font-medium">Save favorite route</button></div>
      {routeSteps.length ? <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-700"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">Street route</p><p>{distanceMiles?.toFixed(2)} mi · {durationMinutes} min</p></div><ol className="mt-2 list-decimal space-y-1 pl-5">{routeSteps.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ol></div> : null}
      <div><h3 className="font-semibold">Favorite routes</h3><div className="mt-3 grid gap-2">{favorites.length === 0 ? <p className="text-sm text-slate-600">No favorites saved on this device yet.</p> : favorites.map((favorite) => <button key={favorite.id} type="button" onClick={() => loadFavorite(favorite)} className="rounded-xl border px-4 py-3 text-left"><span className="block font-medium">{favorite.name}</span><span className="block text-sm text-slate-500">Apex {favorite.apexMiles.toFixed(1)} mi</span></button>)}</div></div>
    </section>
  );
}
