'use client';

import { useEffect, useRef, useState } from 'react';

type Pt = { x: number; y: number };
type Geo = { lat: number; lng: number };
type Saved = { id: string; name: string; apexMiles: number; createdAt: string; routeJson: string };

const KEY = 'buddies_walk_favorites_v24';
const R = 3958.8;
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
function mapboxZoomFromFeet(viewFeet: number) {
  if (viewFeet <= 100) return 18.8;
  if (viewFeet <= 250) return 17.7;
  if (viewFeet <= 500) return 16.7;
  if (viewFeet <= 1000) return 15.7;
  if (viewFeet <= 2640) return 14.3;
  if (viewFeet <= 5280) return 13.2;
  if (viewFeet <= 13200) return 12.0;
  return 11.0;
}

function dest(start: Geo, miles: number, bearingDeg: number): Geo {
  const br = bearingDeg * Math.PI / 180;
  const lat1 = start.lat * Math.PI / 180;
  const lon1 = start.lng * Math.PI / 180;
  const d = miles / R;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(br));
  const lon2 = lon1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: Number((lat2 * 180 / Math.PI).toFixed(6)), lng: Number((lon2 * 180 / Math.PI).toFixed(6)) };
}

function bearing(a: Geo, b: Geo) {
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

function path(points: Pt[]) { return points.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '); }

function geoToPt(geo: Geo, center: Geo, radiusMiles: number) {
  const milesPerLat = 69;
  const milesPerLng = 69 * Math.cos(center.lat * Math.PI / 180);
  return {
    x: MAP_SIZE / 2 + ((geo.lng - center.lng) * milesPerLng / radiusMiles) * (MAP_SIZE / 2),
    y: MAP_SIZE / 2 - ((geo.lat - center.lat) * milesPerLat / radiusMiles) * (MAP_SIZE / 2)
  };
}

function ptToGeo(pt: Pt, center: Geo, radiusMiles: number): Geo {
  const milesPerLat = 69;
  const milesPerLng = 69 * Math.cos(center.lat * Math.PI / 180);
  const lng = center.lng + (((pt.x - MAP_SIZE / 2) / (MAP_SIZE / 2)) * radiusMiles) / milesPerLng;
  const lat = center.lat - (((pt.y - MAP_SIZE / 2) / (MAP_SIZE / 2)) * radiusMiles) / milesPerLat;
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}

function pinLabel(index: number) { return index === 0 ? 'Start' : index === 1 ? 'Apex' : index === 2 ? 'Return' : 'End'; }

function AnimatedMapBase({ viewFeet }: { viewFeet: number }) {
  const block = viewFeet <= 500 ? 32 : viewFeet <= 1000 ? 42 : viewFeet <= 5280 ? 56 : 72;
  return (
    <div className="absolute inset-0 overflow-hidden bg-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(14,165,233,.22),transparent_24%),radial-gradient(circle_at_78%_28%,rgba(34,197,94,.18),transparent_22%),radial-gradient(circle_at_56%_78%,rgba(99,102,241,.16),transparent_26%)]" />
      <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(90deg,rgba(15,23,42,.10) 1px,transparent 1px),linear-gradient(rgba(15,23,42,.10) 1px,transparent 1px)', backgroundSize: `${block}px ${block}px` }} />
      <div className="absolute -left-20 top-16 h-24 w-[150%] rotate-[-12deg] rounded-full bg-white/70" />
      <div className="absolute -left-16 top-56 h-20 w-[140%] rotate-[18deg] rounded-full bg-white/65" />
      <div className="absolute left-24 top-0 h-full w-16 rotate-[8deg] rounded-full bg-white/55" />
      <div className="absolute left-0 top-0 h-full w-full animate-pulse bg-gradient-to-br from-transparent via-white/20 to-transparent" />
      <div className="absolute bottom-4 right-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold shadow">Animated map · {viewFeet.toLocaleString()} ft</div>
    </div>
  );
}

export default function WalkRoutePlanner() {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const [center, setCenter] = useState<Geo>(DEFAULT_CENTER);
  const [start, setStart] = useState<Geo | null>(DEFAULT_CENTER);
  const [destinationPoint, setDestinationPoint] = useState<Geo | null>(null);
  const [status, setStatus] = useState('Default animated map starts at +500 ft. Zoom changes by exactly 20 ft per step.');
  const [area, setArea] = useState<Pt[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [mode, setMode] = useState<'select' | 'draw'>('select');
  const [apexMiles, setApexMiles] = useState(1);
  const [routeName, setRouteName] = useState('Neighborhood walk');
  const [route, setRoute] = useState<Geo[]>([]);
  const [favorites, setFavorites] = useState<Saved[]>([]);
  const [mapFailed, setMapFailed] = useState(false);
  const [viewFeet, setViewFeet] = useState(DEFAULT_VIEW_FEET);

  useEffect(() => { try { setFavorites(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { setFavorites([]); } }, []);

  const radiusMiles = viewMiles(viewFeet);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
  const mapUrl = token && !mapFailed ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${center.lng},${center.lat},${mapboxZoomFromFeet(viewFeet)},0/${MAP_SIZE}x${MAP_SIZE}?access_token=${token}` : '';

  function setView(value: number) { setViewFeet(normalizeFeet(value)); }
  function zoomIn() { setView(viewFeet - ZOOM_STEP_FEET); }
  function zoomOut() { setView(viewFeet + ZOOM_STEP_FEET); }

  function locate() {
    if (!navigator.geolocation) return setStatus('Location is unavailable in this browser. Animated +500 ft view remains active.');
    setStatus('Requesting location...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) };
        setCenter(here); setStart(here); setDestinationPoint(null); setRoute([]); setMapFailed(false); setView(DEFAULT_VIEW_FEET);
        setStatus('Start location set at +500 ft. Tap the apex/turnaround point next.');
      },
      () => setStatus('Location permission denied. Animated +500 ft view remains active.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  function point(e: React.PointerEvent<HTMLDivElement>) {
    const box = layerRef.current?.getBoundingClientRect();
    if (!box) return null;
    return { x: clamp(((e.clientX - box.left) / box.width) * MAP_SIZE, 0, MAP_SIZE), y: clamp(((e.clientY - box.top) / box.height) * MAP_SIZE, 0, MAP_SIZE) };
  }

  function down(e: React.PointerEvent<HTMLDivElement>) {
    const p = point(e);
    if (!p) return;
    if (mode === 'draw') { setArea([p]); setDrawing(true); return; }
    const geo = ptToGeo(p, center, radiusMiles);
    if (!start) { setStart(geo); setStatus('Start point selected. Tap an apex/turnaround point.'); }
    else { setDestinationPoint(geo); setStatus('Apex point selected. Generate route variations or save this route.'); }
  }

  function move(e: React.PointerEvent<HTMLDivElement>) { const p = point(e); if (mode === 'draw' && drawing && p) setArea((v) => [...v, p].slice(-180)); }
  function up() { setDrawing(false); }

  function suggest() {
    const base = start || center;
    const b1 = destinationPoint ? bearing(base, destinationPoint) : Math.random() * 360;
    const apex = destinationPoint || dest(base, apexMiles, b1);
    const variation = dest(apex, Math.max(0.05, apexMiles * 0.25), b1 + 135 + Math.random() * 90);
    setRoute([base, apex, variation, base]);
  }

  const routeJson = JSON.stringify({ name: routeName, center, start, destinationPoint, apexMiles, area, route, viewFeet });

  function saveFavorite() {
    const next = [{ id: String(Date.now()), name: routeName, apexMiles, createdAt: new Date().toISOString(), routeJson }, ...favorites].slice(0, 20);
    setFavorites(next); localStorage.setItem(KEY, JSON.stringify(next));
  }

  function loadFavorite(saved: Saved) {
    const data = JSON.parse(saved.routeJson);
    setRouteName(data.name || saved.name); setCenter(data.center || DEFAULT_CENTER); setApexMiles(data.apexMiles || saved.apexMiles);
    setStart(data.start || DEFAULT_CENTER); setDestinationPoint(data.destinationPoint || null); setArea(data.area || []); setRoute(data.route || []); setView(data.viewFeet || DEFAULT_VIEW_FEET);
  }

  const pins = [start, destinationPoint].filter(Boolean) as Geo[];
  const line = route.length > 1 ? route.map((g, i) => { const p = geoToPt(g, center, radiusMiles); return `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`; }).join(' ') : '';

  return (
    <section className="grid gap-5 rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
      <div><h2 className="text-xl font-semibold">Walk route planner</h2><p className="mt-1 text-sm text-slate-600">Starts at +500 ft. Zoom in/out changes the map scale by exactly 20 ft per tap. The 5-mile limit remains available by dragging the scale slider outward.</p></div>
      <input type="hidden" name="routeName" value={routeName} />
      <input type="hidden" name="routeJson" value={routeJson} />
      <div className="grid gap-3 sm:grid-cols-3"><button type="button" onClick={locate} className="rounded-lg bg-slate-900 px-4 py-3 font-medium text-white">Use current location</button><button type="button" onClick={() => setMode(mode === 'select' ? 'draw' : 'select')} className="rounded-lg border px-4 py-3 font-medium">Mode: {mode === 'select' ? 'select points' : 'draw area'}</button><button type="button" onClick={() => { setArea([]); setRoute([]); setDestinationPoint(null); }} className="rounded-lg border px-4 py-3 font-medium">Clear</button></div>
      <div className="grid gap-3 rounded-xl border bg-slate-50 p-3">
        <div className="flex items-center gap-3"><button type="button" onClick={zoomIn} className="h-11 w-11 rounded-lg border bg-white text-xl font-bold">+</button><input aria-label="Map view scale in feet" type="range" min={MIN_VIEW_FEET} max={MAX_VIEW_FEET} step={ZOOM_STEP_FEET} value={viewFeet} onChange={(e) => setView(Number(e.target.value))} className="min-w-0 flex-1" /><button type="button" onClick={zoomOut} className="h-11 w-11 rounded-lg border bg-white text-xl font-bold">−</button></div>
        <p className="text-xs font-semibold text-slate-600">View scale: +{viewFeet.toLocaleString()} ft · step: 20 ft · max: 5 mi</p>
      </div>
      <p className="text-sm text-slate-600">{status}</p>
      <div className="relative h-[420px] overflow-auto rounded-2xl border bg-slate-100 touch-pan-x touch-pan-y">
        <div ref={layerRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} className="relative h-full w-full" style={{ touchAction: mode === 'draw' ? 'none' : 'pan-x pan-y' }}>
          <AnimatedMapBase viewFeet={viewFeet} />
          {mapUrl ? <img src={mapUrl} onError={() => setMapFailed(true)} alt="Map centered on selected walk area" className="absolute inset-0 h-full w-full object-cover opacity-95" /> : null}
          <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold shadow">+{viewFeet.toLocaleString()} ft · {center.lat}, {center.lng}</div>
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 640 640" preserveAspectRatio="none">
            <circle cx="320" cy="320" r="310" fill="rgba(14,165,233,.08)" stroke="rgba(2,132,199,.55)" strokeWidth="5" />
            {area.length > 1 ? <path d={path(area)} fill="rgba(14,165,233,.12)" stroke="rgba(15,23,42,.75)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /> : null}
            {line ? <path d={line} fill="none" stroke="rgba(2,132,199,.95)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="14 10" /> : null}
            {pins.map((g, i) => { const p = geoToPt(g, center, radiusMiles); return <g key={i}><circle cx={p.x} cy={p.y} r="16" fill="#0f172a" /><text x={p.x + 20} y={p.y + 5} fill="#0f172a" fontSize="24" fontWeight="700">{pinLabel(i)}</text></g>; })}
          </svg>
        </div>
      </div>
      <label className="grid gap-2 text-sm font-medium">Route name<input value={routeName} onChange={(e) => setRouteName(e.target.value)} className="rounded-lg border px-3 py-3 text-base" /></label>
      <label className="grid gap-2 text-sm font-medium">Apex distance fallback: {apexMiles.toFixed(1)} miles<input type="range" min="0.1" max="5" step="0.1" value={apexMiles} onChange={(e) => setApexMiles(Number(e.target.value))} /></label>
      <div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={suggest} className="rounded-lg bg-slate-900 px-4 py-3 font-medium text-white">Suggest random return route</button><button type="button" onClick={saveFavorite} className="rounded-lg border px-4 py-3 font-medium">Save favorite route</button></div>
      {route.length ? <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-700"><p className="font-semibold">Current route</p>{route.map((p, i) => <p key={i}>{i === 0 ? 'Start/Return' : i === 1 ? 'Apex' : 'Return variation'}: {p.lat}, {p.lng}</p>)}</div> : null}
      <div><h3 className="font-semibold">Favorite routes</h3><div className="mt-3 grid gap-2">{favorites.length === 0 ? <p className="text-sm text-slate-600">No favorites saved on this device yet.</p> : favorites.map((fav) => <button key={fav.id} type="button" onClick={() => loadFavorite(fav)} className="rounded-xl border px-4 py-3 text-left"><span className="block font-medium">{fav.name}</span><span className="block text-sm text-slate-500">Apex {fav.apexMiles.toFixed(1)} mi</span></button>)}</div></div>
    </section>
  );
}
