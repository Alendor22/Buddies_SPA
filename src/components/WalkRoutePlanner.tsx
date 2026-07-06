'use client';

import { useEffect, useRef, useState } from 'react';

type Pt = { x: number; y: number };
type Geo = { lat: number; lng: number };
type Saved = { id: string; name: string; apexMiles: number; createdAt: string; routeJson: string };

const KEY = 'buddies_walk_favorites_v24';
const R = 3958.8;

function dest(start: Geo, miles: number, bearingDeg: number): Geo {
  const br = bearingDeg * Math.PI / 180;
  const lat1 = start.lat * Math.PI / 180;
  const lon1 = start.lng * Math.PI / 180;
  const d = miles / R;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(br));
  const lon2 = lon1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: Number((lat2 * 180 / Math.PI).toFixed(6)), lng: Number((lon2 * 180 / Math.PI).toFixed(6)) };
}

function path(points: Pt[]) {
  return points.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}

export default function WalkRoutePlanner() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [start, setStart] = useState<Geo | null>(null);
  const [status, setStatus] = useState('Set a start location, then draw the walk area.');
  const [area, setArea] = useState<Pt[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [apexMiles, setApexMiles] = useState(1);
  const [routeName, setRouteName] = useState('Neighborhood walk');
  const [route, setRoute] = useState<Geo[]>([]);
  const [favorites, setFavorites] = useState<Saved[]>([]);

  useEffect(() => {
    try { setFavorites(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { setFavorites([]); }
  }, []);

  function locate() {
    if (!navigator.geolocation) return setStatus('Location is unavailable in this browser.');
    setStatus('Requesting location...');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setStart({ lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) }); setStatus('Start location set.'); },
      () => setStatus('Location permission denied. You can still draft the route area.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  function point(e: React.PointerEvent<HTMLDivElement>) {
    const box = ref.current?.getBoundingClientRect();
    return box ? { x: e.clientX - box.left, y: e.clientY - box.top } : null;
  }

  function down(e: React.PointerEvent<HTMLDivElement>) { const p = point(e); if (p) { setArea([p]); setDrawing(true); } }
  function move(e: React.PointerEvent<HTMLDivElement>) { const p = point(e); if (drawing && p) setArea((v) => [...v, p].slice(-180)); }
  function up() { setDrawing(false); }

  function suggest() {
    const base = start || { lat: 40.7128, lng: -74.0060 };
    const b1 = Math.random() * 360;
    const apex = dest(base, apexMiles, b1);
    const variation = dest(apex, Math.max(0.1, apexMiles * 0.35), b1 + 140 + Math.random() * 80);
    setRoute([base, apex, variation, base]);
  }

  const routeJson = JSON.stringify({ name: routeName, start, apexMiles, area, route });

  function saveFavorite() {
    const next = [{ id: String(Date.now()), name: routeName, apexMiles, createdAt: new Date().toISOString(), routeJson }, ...favorites].slice(0, 20);
    setFavorites(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  }

  function loadFavorite(saved: Saved) {
    const data = JSON.parse(saved.routeJson);
    setRouteName(data.name || saved.name);
    setApexMiles(data.apexMiles || saved.apexMiles);
    setStart(data.start || null);
    setArea(data.area || []);
    setRoute(data.route || []);
  }

  return (
    <section className="grid gap-5 rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
      <div><h2 className="text-xl font-semibold">Walk route planner</h2><p className="mt-1 text-sm text-slate-600">Draw a walk zone with your finger. The planner supports mobile scroll/pinch, a start point, apex distance up to 5 miles, random return routes, and saved favorites.</p></div>
      <input type="hidden" name="routeName" value={routeName} />
      <input type="hidden" name="routeJson" value={routeJson} />
      <div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={locate} className="rounded-lg bg-slate-900 px-4 py-3 font-medium text-white">Use current location</button><button type="button" onClick={() => setArea([])} className="rounded-lg border px-4 py-3 font-medium">Clear drawing</button></div>
      <p className="text-sm text-slate-600">{status}</p>
      <div ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} className="relative h-[360px] overflow-auto rounded-2xl border bg-slate-100 touch-pan-x touch-pan-y">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,23,42,.08)_1px,transparent_1px),linear-gradient(rgba(15,23,42,.08)_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold shadow">{start ? `${start.lat}, ${start.lng}` : 'Location draft'}</div>
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 360" preserveAspectRatio="none">
          {area.length > 1 ? <path d={path(area)} fill="rgba(14,165,233,.12)" stroke="rgba(15,23,42,.75)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /> : null}
          {route.length > 1 ? <path d="M 50 170 L 185 55 L 300 125 L 350 170" fill="none" stroke="rgba(2,132,199,.95)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="10 8" /> : null}
        </svg>
      </div>
      <label className="grid gap-2 text-sm font-medium">Route name<input value={routeName} onChange={(e) => setRouteName(e.target.value)} className="rounded-lg border px-3 py-3 text-base" /></label>
      <label className="grid gap-2 text-sm font-medium">Apex distance: {apexMiles.toFixed(1)} miles<input type="range" min="0.1" max="5" step="0.1" value={apexMiles} onChange={(e) => setApexMiles(Number(e.target.value))} /></label>
      <div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={suggest} className="rounded-lg bg-slate-900 px-4 py-3 font-medium text-white">Suggest random return route</button><button type="button" onClick={saveFavorite} className="rounded-lg border px-4 py-3 font-medium">Save favorite route</button></div>
      {route.length ? <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-700"><p className="font-semibold">Current route</p>{route.map((p, i) => <p key={i}>{i === 0 ? 'Start/Return' : i === 1 ? 'Apex' : 'Return variation'}: {p.lat}, {p.lng}</p>)}</div> : null}
      <div><h3 className="font-semibold">Favorite routes</h3><div className="mt-3 grid gap-2">{favorites.length === 0 ? <p className="text-sm text-slate-600">No favorites saved on this device yet.</p> : favorites.map((fav) => <button key={fav.id} type="button" onClick={() => loadFavorite(fav)} className="rounded-xl border px-4 py-3 text-left"><span className="block font-medium">{fav.name}</span><span className="block text-sm text-slate-500">Apex {fav.apexMiles.toFixed(1)} mi</span></button>)}</div></div>
    </section>
  );
}
