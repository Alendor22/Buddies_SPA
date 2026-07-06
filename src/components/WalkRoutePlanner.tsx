'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Pt = { x: number; y: number };
type Geo = { lat: number; lng: number };
type Saved = { id: string; name: string; apexMiles: number; createdAt: string; routeJson: string };

const KEY = 'buddies_walk_favorites_v24';
const R = 3958.8;
const DEFAULT_CENTER: Geo = { lat: 40.685743, lng: -73.941329 };

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

function path(points: Pt[]) {
  return points.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}

function geoToPt(geo: Geo, center: Geo, size = 640) {
  const milesPerLat = 69;
  const milesPerLng = 69 * Math.cos(center.lat * Math.PI / 180);
  return {
    x: size / 2 + ((geo.lng - center.lng) * milesPerLng / 5) * (size / 2),
    y: size / 2 - ((geo.lat - center.lat) * milesPerLat / 5) * (size / 2)
  };
}

function ptToGeo(pt: Pt, center: Geo, size = 640): Geo {
  const milesPerLat = 69;
  const milesPerLng = 69 * Math.cos(center.lat * Math.PI / 180);
  const lng = center.lng + (((pt.x - size / 2) / (size / 2)) * 5) / milesPerLng;
  const lat = center.lat - (((pt.y - size / 2) / (size / 2)) * 5) / milesPerLat;
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}

function pinLabel(index: number) {
  if (index === 0) return 'Start';
  if (index === 1) return 'Apex';
  if (index === 2) return 'Return';
  return 'End';
}

export default function WalkRoutePlanner() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [center, setCenter] = useState<Geo>(DEFAULT_CENTER);
  const [start, setStart] = useState<Geo | null>(null);
  const [destinationPoint, setDestinationPoint] = useState<Geo | null>(null);
  const [status, setStatus] = useState('Default map is a 5 mile radius. Use current location to center it, then tap two points.');
  const [area, setArea] = useState<Pt[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [mode, setMode] = useState<'select' | 'draw'>('select');
  const [apexMiles, setApexMiles] = useState(5);
  const [routeName, setRouteName] = useState('Neighborhood walk');
  const [route, setRoute] = useState<Geo[]>([]);
  const [favorites, setFavorites] = useState<Saved[]>([]);

  useEffect(() => {
    try { setFavorites(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { setFavorites([]); }
  }, []);

  const mapUrl = useMemo(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return '';
    return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${center.lng},${center.lat},11.7,0/640x640?access_token=${token}`;
  }, [center]);

  function locate() {
    if (!navigator.geolocation) return setStatus('Location is unavailable in this browser.');
    setStatus('Requesting location...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) };
        setCenter(here);
        setStart(here);
        setDestinationPoint(null);
        setRoute([]);
        setStatus('Start location set. Map centered to a 5 mile radius. Tap the apex/turnaround point next.');
      },
      () => setStatus('Location permission denied. Map is using the default 5 mile radius draft location.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  function point(e: React.PointerEvent<HTMLDivElement>) {
    const box = ref.current?.getBoundingClientRect();
    return box ? { x: e.clientX - box.left, y: e.clientY - box.top } : null;
  }

  function down(e: React.PointerEvent<HTMLDivElement>) {
    const p = point(e);
    if (!p) return;
    if (mode === 'draw') {
      setArea([p]);
      setDrawing(true);
      return;
    }
    const geo = ptToGeo(p, center, ref.current?.clientWidth || 640);
    if (!start) {
      setStart(geo);
      setStatus('Start point selected. Tap an apex/turnaround point.');
    } else {
      setDestinationPoint(geo);
      setApexMiles(Math.min(5, Math.max(0.1, apexMiles)));
      setStatus('Apex point selected. Generate route variations or save this route.');
    }
  }

  function move(e: React.PointerEvent<HTMLDivElement>) {
    const p = point(e);
    if (mode === 'draw' && drawing && p) setArea((v) => [...v, p].slice(-180));
  }
  function up() { setDrawing(false); }

  function suggest() {
    const base = start || center;
    const b1 = destinationPoint ? bearing(base, destinationPoint) : Math.random() * 360;
    const apex = destinationPoint || dest(base, apexMiles, b1);
    const variation = dest(apex, Math.max(0.1, apexMiles * 0.25), b1 + 135 + Math.random() * 90);
    setRoute([base, apex, variation, base]);
  }

  const routeJson = JSON.stringify({ name: routeName, center, start, destinationPoint, apexMiles, area, route });

  function saveFavorite() {
    const next = [{ id: String(Date.now()), name: routeName, apexMiles, createdAt: new Date().toISOString(), routeJson }, ...favorites].slice(0, 20);
    setFavorites(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  }

  function loadFavorite(saved: Saved) {
    const data = JSON.parse(saved.routeJson);
    setRouteName(data.name || saved.name);
    setCenter(data.center || DEFAULT_CENTER);
    setApexMiles(data.apexMiles || saved.apexMiles);
    setStart(data.start || null);
    setDestinationPoint(data.destinationPoint || null);
    setArea(data.area || []);
    setRoute(data.route || []);
  }

  const pins = [start, destinationPoint].filter(Boolean) as Geo[];
  const line = route.length > 1 ? route.map((g, i) => {
    const p = geoToPt(g, center);
    return `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }).join(' ') : '';

  return (
    <section className="grid gap-5 rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
      <div><h2 className="text-xl font-semibold">Walk route planner</h2><p className="mt-1 text-sm text-slate-600">Default view is a 5 mile radius. Start at current location, or tap any two map points: start and apex. Draw mode lets you sketch a walk zone.</p></div>
      <input type="hidden" name="routeName" value={routeName} />
      <input type="hidden" name="routeJson" value={routeJson} />
      <div className="grid gap-3 sm:grid-cols-3"><button type="button" onClick={locate} className="rounded-lg bg-slate-900 px-4 py-3 font-medium text-white">Use current location</button><button type="button" onClick={() => setMode(mode === 'select' ? 'draw' : 'select')} className="rounded-lg border px-4 py-3 font-medium">Mode: {mode === 'select' ? 'select points' : 'draw area'}</button><button type="button" onClick={() => { setArea([]); setRoute([]); setDestinationPoint(null); }} className="rounded-lg border px-4 py-3 font-medium">Clear</button></div>
      <p className="text-sm text-slate-600">{status}</p>
      <div ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} className="relative h-[420px] overflow-auto rounded-2xl border bg-slate-100 touch-pan-x touch-pan-y">
        {mapUrl ? <img src={mapUrl} alt="Map centered on selected walk area" className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,23,42,.08)_1px,transparent_1px),linear-gradient(rgba(15,23,42,.08)_1px,transparent_1px)] bg-[size:32px_32px]" />}
        <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold shadow">5 mi radius · {center.lat}, {center.lng}</div>
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 640 640" preserveAspectRatio="none">
          <circle cx="320" cy="320" r="310" fill="rgba(14,165,233,.08)" stroke="rgba(2,132,199,.45)" strokeWidth="4" />
          {area.length > 1 ? <path d={path(area)} fill="rgba(14,165,233,.12)" stroke="rgba(15,23,42,.75)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /> : null}
          {line ? <path d={line} fill="none" stroke="rgba(2,132,199,.95)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="14 10" /> : null}
          {pins.map((g, i) => { const p = geoToPt(g, center); return <g key={i}><circle cx={p.x} cy={p.y} r="16" fill="#0f172a" /><text x={p.x + 20} y={p.y + 5} fill="#0f172a" fontSize="24" fontWeight="700">{pinLabel(i)}</text></g>; })}
        </svg>
      </div>
      <label className="grid gap-2 text-sm font-medium">Route name<input value={routeName} onChange={(e) => setRouteName(e.target.value)} className="rounded-lg border px-3 py-3 text-base" /></label>
      <label className="grid gap-2 text-sm font-medium">Apex distance fallback: {apexMiles.toFixed(1)} miles<input type="range" min="0.1" max="5" step="0.1" value={apexMiles} onChange={(e) => setApexMiles(Number(e.target.value))} /></label>
      <div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={suggest} className="rounded-lg bg-slate-900 px-4 py-3 font-medium text-white">Suggest random return route</button><button type="button" onClick={saveFavorite} className="rounded-lg border px-4 py-3 font-medium">Save favorite route</button></div>
      {route.length ? <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-700"><p className="font-semibold">Current route</p>{route.map((p, i) => <p key={i}>{i === 0 ? 'Start/Return' : i === 1 ? 'Apex' : 'Return variation'}: {p.lat}, {p.lng}</p>)}</div> : null}
      <div><h3 className="font-semibold">Favorite routes</h3><div className="mt-3 grid gap-2">{favorites.length === 0 ? <p className="text-sm text-slate-600">No favorites saved on this device yet.</p> : favorites.map((fav) => <button key={fav.id} type="button" onClick={() => loadFavorite(fav)} className="rounded-xl border px-4 py-3 text-left"><span className="block font-medium">{fav.name}</span><span className="block text-sm text-slate-500">Apex {fav.apexMiles.toFixed(1)} mi</span></button>)}</div></div>
    </section>
  );
}
