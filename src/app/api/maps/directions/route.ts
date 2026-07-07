import { NextRequest, NextResponse } from 'next/server';
import { getMapboxToken } from '@/lib/mapboxToken';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAPBOX_TIMEOUT_MS = 15_000;

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

function noStoreJson(body: unknown, status = 200) {
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
  const startedAt = Date.now();
  const token = getMapboxToken();

  if (!token) {
    return noStoreJson({ error: 'Mapbox access token is not configured.' }, 503);
  }

  const payload = await request.json().catch(() => null) as { coordinates?: unknown } | null;
  const coordinates = Array.isArray(payload?.coordinates)
    ? payload.coordinates.filter(validCoordinate)
    : [];

  if (coordinates.length < 2 || coordinates.length > 25) {
    return noStoreJson({ error: 'Provide between 2 and 25 valid coordinates.' }, 400);
  }

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
    walkway_bias: '0.5',
    radiuses: coordinates.map(() => 'unlimited').join(';')
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MAPBOX_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinatePath}?${query.toString()}`,
      {
        cache: 'no-store',
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      }
    );

    const raw = await response.text();
    let data: MapboxResponse | null = null;

    try {
      data = raw ? JSON.parse(raw) as MapboxResponse : null;
    } catch {
      data = null;
    }

    if (!response.ok || data?.code !== 'Ok' || !data.routes?.length) {
      return noStoreJson(
        {
          error: data?.message || `Mapbox returned ${response.status} while snapping the flags to streets.`,
          code: data?.code || 'MAPBOX_ERROR',
          elapsedMs: Date.now() - startedAt
        },
        response.ok ? 422 : response.status
      );
    }

    const route = data.routes[0];
    const geometry = route.geometry?.coordinates;

    if (!Array.isArray(geometry) || geometry.length < 2) {
      return noStoreJson(
        {
          error: 'Mapbox returned a route without usable street geometry.',
          code: 'EMPTY_GEOMETRY',
          elapsedMs: Date.now() - startedAt
        },
        422
      );
    }

    const steps = route.legs
      .flatMap((leg) => leg.steps ?? [])
      .map((step) => ({
        instruction: step.maneuver?.instruction
          || (step.name ? `Continue on ${step.name}` : 'Continue on the route'),
        street: step.name || null,
        distanceFeet: Math.round((step.distance || 0) * 3.28084),
        durationSeconds: Math.round(step.duration || 0)
      }));

    return noStoreJson({
      geometry: geometry.map(([lng, lat]) => ({ lng, lat })),
      steps,
      distanceMiles: Number((route.distance / 1609.344).toFixed(2)),
      durationMinutes: Math.max(1, Math.round(route.duration / 60)),
      waypointCount: coordinates.length - 2,
      elapsedMs: Date.now() - startedAt
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';

    return noStoreJson(
      {
        error: timedOut
          ? 'Street snapping timed out after 15 seconds. Move any flag that is far from a walkable street and retry.'
          : 'The street-routing service could not be reached. Retry the route.',
        code: timedOut ? 'MAPBOX_TIMEOUT' : 'MAPBOX_UNAVAILABLE',
        elapsedMs: Date.now() - startedAt
      },
      timedOut ? 504 : 502
    );
  } finally {
    clearTimeout(timeout);
  }
}
