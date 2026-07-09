import { NextRequest, NextResponse } from 'next/server';
import { getMapboxToken } from '@/lib/mapboxToken';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SEGMENT_TIMEOUT_MS = 8_000;
const MAX_COORDINATES = 25;

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

function sameCoordinate(a: Coordinate, b: Coordinate) {
  return Math.abs(a.lat - b.lat) < 0.000001 && Math.abs(a.lng - b.lng) < 0.000001;
}

function loopCoordinates(points: Coordinate[]) {
  if (points.length < 2) return points;
  const first = points[0];
  const last = points[points.length - 1];
  return sameCoordinate(first, last) ? points : [...points, first];
}

async function fetchSegment(start: Coordinate, end: Coordinate, token: string) {
  const coordinatePath = `${start.lng.toFixed(6)},${start.lat.toFixed(6)};${end.lng.toFixed(6)},${end.lat.toFixed(6)}`;
  const query = new URLSearchParams({
    access_token: token,
    alternatives: 'false',
    geometries: 'geojson',
    overview: 'full',
    steps: 'true',
    language: 'en',
    continue_straight: 'false',
    radiuses: 'unlimited;unlimited'
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEGMENT_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinatePath}?${query.toString()}`,
      { cache: 'no-store', signal: controller.signal, headers: { Accept: 'application/json' } }
    );

    const raw = await response.text();
    let data: MapboxResponse | null = null;
    try {
      data = raw ? JSON.parse(raw) as MapboxResponse : null;
    } catch {
      data = null;
    }

    if (!response.ok || data?.code !== 'Ok' || !data.routes?.length) {
      throw new Error(data?.message || `Mapbox returned ${response.status} while snapping this segment to streets.`);
    }

    return data.routes[0];
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const token = getMapboxToken();

  if (!token) {
    return noStoreJson({ error: 'Mapbox access token is not configured.' }, 503);
  }

  const payload = await request.json().catch(() => null) as { coordinates?: unknown } | null;
  const submitted = Array.isArray(payload?.coordinates)
    ? payload.coordinates.filter(validCoordinate)
    : [];

  if (submitted.length < 2 || submitted.length > MAX_COORDINATES) {
    return noStoreJson({ error: `Provide between 2 and ${MAX_COORDINATES} valid coordinates.` }, 400);
  }

  const coordinates = loopCoordinates(submitted);
  const geometry: Coordinate[] = [];
  const steps: Array<{ instruction: string; street: string | null; distanceFeet: number; durationSeconds: number }> = [];
  let distanceMeters = 0;
  let durationSeconds = 0;

  try {
    for (let index = 0; index < coordinates.length - 1; index += 1) {
      const segment = await fetchSegment(coordinates[index], coordinates[index + 1], token);
      const segmentGeometry = segment.geometry?.coordinates ?? [];

      if (segmentGeometry.length < 2) {
        return noStoreJson({ error: 'Mapbox returned a segment without usable street geometry.', code: 'EMPTY_GEOMETRY', segment: index + 1 }, 422);
      }

      const mappedGeometry = segmentGeometry.map(([lng, lat]) => ({ lng, lat }));
      geometry.push(...(geometry.length ? mappedGeometry.slice(1) : mappedGeometry));
      distanceMeters += segment.distance || 0;
      durationSeconds += segment.duration || 0;
      steps.push(...segment.legs.flatMap((leg) => leg.steps ?? []).map((step) => ({
        instruction: step.maneuver?.instruction || (step.name ? `Continue on ${step.name}` : 'Continue on the route'),
        street: step.name || null,
        distanceFeet: Math.round((step.distance || 0) * 3.28084),
        durationSeconds: Math.round(step.duration || 0)
      })));
    }

    return noStoreJson({
      geometry,
      steps,
      distanceMiles: Number((distanceMeters / 1609.344).toFixed(2)),
      durationMinutes: Math.max(1, Math.round(durationSeconds / 60)),
      waypointCount: Math.max(0, coordinates.length - 2),
      looped: true,
      elapsedMs: Date.now() - startedAt
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    return noStoreJson({
      error: timedOut
        ? 'Street snapping timed out on one route segment. Move the nearest flag closer to a mapped street and retry.'
        : error instanceof Error
          ? error.message
          : 'The street-routing service could not be reached. Retry the route.',
      code: timedOut ? 'MAPBOX_TIMEOUT' : 'MAPBOX_UNAVAILABLE',
      elapsedMs: Date.now() - startedAt
    }, timedOut ? 504 : 502);
  }
}
