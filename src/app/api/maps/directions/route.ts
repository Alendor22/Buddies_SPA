import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getMapboxToken } from '@/lib/mapboxToken';
import { rateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_COORDINATES = 25;
const ROUTING_PROFILE = 'mapbox/walking';

type Coordinate = { lng: number; lat: number };

type MapboxStep = {
  name?: string;
  distance?: number;
  duration?: number;
  maneuver?: { instruction?: string };
};

type MapboxRoute = {
  distance: number;
  duration: number;
  geometry: { coordinates: [number, number][] };
  legs: { steps: MapboxStep[] }[];
};

type MapboxResponse = {
  code?: string;
  message?: string;
  routes?: MapboxRoute[];
  waypoints?: Array<{ location: [number, number]; name?: string; distance?: number }>;
};

function validCoordinate(value: unknown): value is Coordinate {
  if (!value || typeof value !== 'object') return false;
  const point = value as Coordinate;
  return Number.isFinite(point.lng)
    && Number.isFinite(point.lat)
    && point.lng >= -180
    && point.lng <= 180
    && point.lat >= -90
    && point.lat <= 90;
}

function sameCoordinate(a: Coordinate, b: Coordinate) {
  return Math.abs(a.lat - b.lat) < 0.000001 && Math.abs(a.lng - b.lng) < 0.000001;
}

function closeLoop(points: Coordinate[]) {
  if (points.length < 2) return points;
  return sameCoordinate(points[0], points[points.length - 1]) ? points : [...points, points[0]];
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'CDN-Cache-Control': 'no-store',
      'Vercel-CDN-Cache-Control': 'no-store'
    }
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return json({ error: 'Authentication required.' }, 401);

  const limit = await rateLimit('maps:directions', user.id, 30, 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many routing requests.' }, {
      status: 429,
      headers: { 'Retry-After': String(limit.retryAfterSeconds) }
    });
  }

  const token = getMapboxToken();
  if (!token) return json({ error: 'Mapbox access token is not configured.' }, 503);

  const payload = await request.json().catch(() => null) as { coordinates?: unknown } | null;
  const submitted = Array.isArray(payload?.coordinates)
    ? payload.coordinates.filter(validCoordinate)
    : [];

  if (submitted.length < 2 || submitted.length > MAX_COORDINATES) {
    return json({ error: `Provide between 2 and ${MAX_COORDINATES} valid coordinates.` }, 400);
  }

  const coordinates = closeLoop(submitted);
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
    continue_straight: 'true',
    radiuses: coordinates.map(() => 'unlimited').join(';'),
    approaches: coordinates.map(() => 'unrestricted').join(';')
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://api.mapbox.com/directions/v5/${ROUTING_PROFILE}/${coordinatePath}?${query.toString()}`,
      { cache: 'no-store', signal: controller.signal, headers: { Accept: 'application/json' } }
    );
    const raw = await response.text();
    const data = raw ? JSON.parse(raw) as MapboxResponse : null;

    if (!response.ok || data?.code !== 'Ok' || !data.routes?.length) {
      return json({
        error: data?.message || 'Mapbox could not construct a walking route through the plotted points.',
        code: data?.code || 'MAPBOX_ROUTE_FAILED'
      }, response.ok ? 422 : response.status);
    }

    const route = data.routes[0];
    const geometry = route.geometry.coordinates.map(([lng, lat]) => ({ lng, lat }));
    const steps = route.legs.flatMap((leg) => leg.steps ?? []).map((step) => ({
      instruction: step.maneuver?.instruction || (step.name ? `Continue on ${step.name}` : 'Continue on the route'),
      street: step.name || null,
      distanceFeet: Math.round((step.distance || 0) * 3.28084),
      durationSeconds: Math.round(step.duration || 0)
    }));

    return json({
      geometry,
      steps,
      snappedWaypoints: (data.waypoints ?? []).map((waypoint) => ({
        lng: waypoint.location[0],
        lat: waypoint.location[1],
        name: waypoint.name || null,
        distanceMeters: waypoint.distance ?? null
      })),
      distanceMiles: Number((route.distance / 1609.344).toFixed(2)),
      durationMinutes: Math.max(1, Math.round(route.duration / 60)),
      waypointCount: Math.max(0, coordinates.length - 2),
      segmentCount: Math.max(1, coordinates.length - 1),
      profile: ROUTING_PROFILE,
      looped: true,
      approximate: false
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    return json({
      error: timedOut
        ? 'Walking-route request timed out. Reduce the number of shaping points or retry.'
        : error instanceof Error
          ? error.message
          : 'Walking-route service could not be reached.',
      code: timedOut ? 'MAPBOX_TIMEOUT' : 'MAPBOX_UNAVAILABLE'
    }, timedOut ? 504 : 502);
  } finally {
    clearTimeout(timeout);
  }
}
