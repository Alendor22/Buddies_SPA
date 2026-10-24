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
    event.preventDefault?.();
    event.originalEvent?.preventDefault?.();
    ignoreNextClickRef.current = true;
    repositionNearest(pointFromEvent(event));
  }

  function coordinateFromClientPoint(x: number, y: number): Coordinate | null {
    const map = mapRef.current?.getMap();
    const container = map?.getContainer();
    if (!map || !container) return null;
    const rect = container.getBoundingClientRect();
    const lngLat = map.unproject([x - rect.left, y - rect.top]);
    return {
      lat: Number(lngLat.lat.toFixed(6)),
      lng: Number(lngLat.lng.toFixed(6))
    };
  }

  function clearTouchTimer() {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchTimerRef.current = null;
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    clearTouchTimer();
    touchTimerRef.current = setTimeout(() => {
      const point = touchStartRef.current;
      const coordinate = point ? coordinateFromClientPoint(point.x, point.y) : null;
      if (!coordinate) return;
      ignoreNextClickRef.current = true;
      addWaypoint(coordinate);
      touchTimerRef.current = null;
    }, LONG_PRESS_MS);
  }

  function handleTouchMove(event: TouchEvent<HTMLDivElement>) {
    const initial = touchStartRef.current;
    if (!initial || !event.touches.length) return;
    const touch = event.touches[0];
    if (Math.hypot(touch.clientX - initial.x, touch.clientY - initial.y) > TOUCH_MOVE_CANCEL_PX) {
      clearTouchTimer();
    }
  }

  function handleTouchEnd() {
    clearTouchTimer();
    touchStartRef.current = null;
  }

  function removeWaypoint(index: number) {
    setSnapPreviewRoute([]);
    patchWalkPlanner({
      waypoints: waypoints.filter((_, waypointIndex) => waypointIndex !== index),
      status: `Flag ${index + 1} removed.`
    });
    resetRoute();
  }

  function clearRoute() {
    setSnapPreviewRoute([]);
    patchWalkPlanner({
      apex: null,
      waypoints: [],
      route: [],
      routeSteps: [],
      distanceMiles: null,
      durationMinutes: null,
      routingState: 'idle',
      routingError: null,
      viewFeet: DEFAULT_VIEW_FEET,
      apexMiles: 0.5,
      status: 'Route cleared. Tap to set Start; long press to add flags.'
    });
  }

  function cancelRouting() {
    routeAbortRef.current?.abort();
    routeAbortRef.current = null;
    patchWalkPlanner({ routingState: 'cancelled', routingError: null, status: 'Driving route cancelled.' });
  }

  async function fetchDirectMapboxRoute(coordinates: Coordinate[]): Promise<DirectionsPayload> {
    if (!token) throw new Error(mapConfigError || 'Mapbox configuration is unavailable for direct routing.');
    const coordinatePath = coordinates
      .map((point) => `${point.lng.toFixed(6)},${point.lat.toFixed(6)}`)
      .join(';');
    const query = new URLSearchParams({
      access_token: token,
      alternatives: 'false',
      geometries: 'geojson',
      overview: 'full',
      steps: 'true',
      language: 'en',
      continue_straight: 'false',
      radiuses: coordinates.map(() => 'unlimited').join(';')
    });
    const response = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinatePath}?${query.toString()}`,
      { cache: 'no-store' }
    );
    const data = await response.json() as {
      code?: string;
      message?: string;
      routes?: Array<{
        distance: number;
        duration: number;
        geometry: { coordinates: [number, number][] };
        legs: Array<{
          steps: Array<{
            name?: string;
            distance?: number;
            duration?: number;
            maneuver?: { instruction?: string };
          }>;
        }>;
      }>;
    };
    const routeData = data.routes?.[0];
    if (!response.ok || data.code !== 'Ok' || !routeData) {
      throw new Error(data.message || 'Direct Mapbox driving route failed.');
    }
    const steps = routeData.legs.flatMap((leg) => leg.steps ?? []).map((step) => ({
      instruction: step.maneuver?.instruction
        || (step.name ? `Continue on ${step.name}` : 'Continue on the route'),
      street: step.name || null,
      distanceFeet: Math.round((step.distance || 0) * 3.28084),
      durationSeconds: Math.round(step.duration || 0)
    }));
    return {
      geometry: routeData.geometry.coordinates.map(([lng, lat]) => ({ lng, lat })),
      steps,
      distanceMiles: Number((routeData.distance / 1609.344).toFixed(2)),
      durationMinutes: Math.max(1, Math.round(routeData.duration / 60))
    };
  }

  function animateSnapCompletion(payload: DirectionsPayload, selectedApex: Coordinate | null) {
    if (revealTimerRef.current) clearInterval(revealTimerRef.current);
    const geometry = payload.geometry;
    if (!geometry.length) return;
    const chunkSize = Math.max(2, Math.ceil(geometry.length / 40));
    let cursor = chunkSize;
    setSnapPreviewRoute(geometry.slice(0, cursor));
    patchWalkPlanner({
      routingState: 'routing',
      routingError: null,
      status: 'Driving route complete. Confirming Start → flags → Start…'
    });
    revealTimerRef.current = setInterval(() => {
      cursor = Math.min(geometry.length, cursor + chunkSize);
      setSnapPreviewRoute(geometry.slice(0, cursor));
      if (cursor >= geometry.length) {
        if (revealTimerRef.current) clearInterval(revealTimerRef.current);
        revealTimerRef.current = null;
        setTimeout(() => {
          setSnapPreviewRoute([]);
          patchWalkPlanner({
            apex: waypoints.length ? null : selectedApex,
            route: geometry,
            routeSteps: payload.steps.map(formatStep),
            distanceMiles: payload.distanceMiles,
            durationMinutes: payload.durationMinutes,
            routingState: 'success',
            routingError: null,
            status: `Driving route follows ${waypoints.length} flag${waypoints.length === 1 ? '' : 's'} and returns to Start.`
          });
          const bounds = boundsForRoute(geometry);
          if (bounds) mapRef.current?.fitBounds(bounds, { padding: 55, duration: 900 });
        }, 250);
      }
    }, 35);
  }

  async function generateStreetRoute(outboundRoll: number, returnRoll: number) {
    const base = start || center;
    let selectedApex = apex;
    let coordinates: Coordinate[];
    if (waypoints.length) {
      coordinates = [base, ...waypoints, base];
    } else {
      const safeMiles = clamp(apexMiles || 0.5, 0.1, MAX_RANDOM_LOOP_MILES);
      const outboundBearing = apex ? bearingBetween(base, apex) : outboundRoll * 360;
      selectedApex = apex || destination(base, safeMiles, outboundBearing);
      const returnWaypoint = destination(
        selectedApex,
        Math.max(0.05, safeMiles * 0.3),
        outboundBearing + 135 + returnRoll * 90
      );
      coordinates = [base, selectedApex, returnWaypoint, base];
    }

    const controller = new AbortController();
    routeAbortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), ROUTE_CLIENT_TIMEOUT_MS);
    patchWalkPlanner({
      routingState: 'routing',
      routingError: null,
      status: `Routing ${coordinates.length - 1} ordered driving segment${coordinates.length === 2 ? '' : 's'}…`
    });

    try {
      let payload: DirectionsPayload & { error?: string };
      try {
        const response = await fetch('/api/maps/directions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coordinates }),
          signal: controller.signal,
          cache: 'no-store'
        });
        payload = await response.json() as DirectionsPayload & { error?: string };
        if (!response.ok) throw new Error(payload.error || 'Server driving route failed.');
      } catch {
        patchWalkPlanner({
          routingState: 'routing',
          routingError: null,
          status: 'Server route was slow. Retrying direct Mapbox driving route…'
        });
        payload = await fetchDirectMapboxRoute(coordinates);
      }
      window.clearTimeout(timeout);
      if (routeAbortRef.current === controller) routeAbortRef.current = null;
      animateSnapCompletion(payload, selectedApex);
    } catch (error) {
      window.clearTimeout(timeout);
      if (routeAbortRef.current === controller) routeAbortRef.current = null;
      const timedOut = error instanceof DOMException && error.name === 'AbortError';
      resetRoute();
      setSnapPreviewRoute([]);
      patchWalkPlanner({
        routingState: timedOut ? 'timeout' : 'error',
        routingError: timedOut
          ? 'Driving route exceeded 75 seconds. Try fewer shaping points.'
          : error instanceof Error ? error.message : 'Driving route failed.',
        status: timedOut ? 'Driving route timed out.' : 'Driving route failed.'
      });
    }
  }

  const routeJson = JSON.stringify({
    name: routeName,
    routeEngine: 'mapbox/directions-driving',
    center,
    start,
    apexPoint: apex,
    waypoints,
    apexMiles,
    route,
    routeSteps,
    distanceMiles,
    durationMinutes,
    viewFeet,
    mapUpdatedAt
  });

  async function saveFavorite() {
    if (!route.length) {
      patchWalkPlanner({ status: 'Generate a driving route before saving it.' });
      return;
    }
    patchWalkPlanner({ savingFavorite: true, status: 'Saving favorite route…' });
    try {
      const response = await fetch('/api/walk-routes/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routeJson })
      });
      const payload = await response.json() as { favorite?: SavedRoute; error?: string };
      if (!response.ok || !payload.favorite) {
        throw new Error(payload.error || 'Favorite route could not be saved.');
      }
      patchWalkPlanner({
        favorites: [payload.favorite, ...favorites].slice(0, 20),
        savingFavorite: false,
        status: 'Favorite route saved.'
      });
    } catch (error) {
      patchWalkPlanner({
        savingFavorite: false,
        status: error instanceof Error ? error.message : 'Favorite route could not be saved.'
      });
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
      patchWalkPlanner({
        favorites: favorites.filter((favorite) => favorite.id !== id),
        status: 'Favorite route removed.'
      });
    } catch (error) {
      patchWalkPlanner({
        status: error instanceof Error ? error.message : 'Favorite route could not be removed.'
      });
    }
  }

  function loadFavorite(saved: SavedRoute) {
    const data = JSON.parse(saved.routeJson) as {
      name?: string;
      center?: Coordinate;
      start?: Coordinate;
      apexPoint?: Coordinate;
      waypoints?: Coordinate[];
      apexMiles?: number;
      route?: Coordinate[];
      routeSteps?: string[];
      distanceMiles?: number;
      durationMinutes?: number;
      viewFeet?: number;
    };
    const loadedRoute = data.route ?? [];
    const loadedCenter = data.center ?? data.start ?? DEFAULT_CENTER;
    patchWalkPlanner({
      routeName: data.name || saved.name,
      center: loadedCenter,
      apexMiles: data.apexMiles || 0.5,
      start: data.start || loadedCenter,
      apex: data.apexPoint || null,
      waypoints: Array.isArray(data.waypoints) ? data.waypoints.slice(0, MAX_WAYPOINTS) : [],
      route: loadedRoute,
      routeSteps: data.routeSteps || [],
      distanceMiles: data.distanceMiles ?? saved.distanceMiles ?? null,
      durationMinutes: data.durationMinutes ?? saved.durationMinutes ?? null,
      viewFeet: normalizeFeet(data.viewFeet || DEFAULT_VIEW_FEET),
      routingState: loadedRoute.length ? 'success' : 'idle',
      routingError: null,
      status: `Loaded favorite route: ${saved.name}.`
    });
    const bounds = boundsForRoute(loadedRoute);
    if (bounds) mapRef.current?.fitBounds(bounds, { padding: 55, duration: 800 });
    else mapRef.current?.flyTo({
      center: [loadedCenter.lng, loadedCenter.lat],
      zoom: zoomForFeet(data.viewFeet || DEFAULT_VIEW_FEET, loadedCenter.lat),
      duration: 700
    });
  }

  return (
    <section className="grid gap-5 bg-transparent p-0">
      <input type="hidden" name="routeName" value={routeName} />
      <input type="hidden" name="routeJson" value={routeJson} />

      <div className="grid gap-2 sm:grid-cols-4">
        <button type="button" onClick={locate} className="rounded-lg bg-slate-950/50 px-4 py-3 font-medium text-white backdrop-blur">Use location</button>
        <button type="button" onClick={() => { if (routing) { cancelRouting(); return; } void generateStreetRoute(Math.random(), Math.random()); }} className={`rounded-lg px-4 py-3 font-medium text-white backdrop-blur ${routing ? 'bg-red-700/60' : 'bg-slate-950/50'}`}>{routing ? 'Cancel routing' : 'Route to streets'}</button>
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
