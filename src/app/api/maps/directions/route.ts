import { NextRequest, NextResponse } from 'next/server';
import { getMapboxToken } from '@/lib/mapboxToken';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SEGMENT_TIMEOUT_MS = 3_500;
const MAX_COORDINATES = 25;
const WALKING_PROFILE = 'mapbox/walking';
const METERS_PER_MILE = 1609.344;

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

type SegmentResult = {
  index: number;
  route: MapboxRoute;
  source: 'mapbox' | 'vector-fallback';
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

function haversineMeters(a: Coordinate, b: Coordinate) {
  const radius = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

function snapToStreetGrid(point: Coordinate): Coordinate {
  const grid = 0.00018;
  return {
    lat: Number((Math.round(point.lat / grid) * grid).toFixed(6)),
    lng: Number((Math.round(point.lng / grid) * grid).toFixed(6))
  };
}

function vectorFallbackSegment(start: Coordinate, end: Coordinate, index: number): SegmentResult {
  const snappedStart = snapToStreetGrid(start);
  const snappedEnd = snapToStreetGrid(end);
  const cornerA = snapToStreetGrid({ lat: snappedStart.lat, lng: snappedEnd.lng });
  const cornerB = snapToStreetGrid({ lat: snappedEnd.lat, lng: snappedStart.lng });
  const firstCorner = haversineMeters(snappedStart, cornerA) + haversineMeters(cornerA, snappedEnd) <= haversineMeters(snappedStart, cornerB) + haversineMeters(cornerB, snappedEnd)
    ? cornerA
    : cornerB;
  const coordinates: [number, number][] = [snappedStart, firstCorner, snappedEnd]
    .filter((point, pointIndex, all) => pointIndex === 0 || !sameCoordinate(point, all[pointIndex - 1]))
    .map((point) => [point.lng, point.lat]);
  const distance = coordinates.slice(0, -1).reduce((sum, coordinate, coordinateIndex) => {
    const current = { lng: coordinate[0], lat: coordinate[1] };
    const next = { lng: coordinates[coordinateIndex + 1][0], lat: coordinates[coordinateIndex + 1][1] };
    return sum + haversineMeters(current, next);
  }, 0);

  return {
    index,
    source: 'vector-fallback',
    route: {
      distance,
      duration: Math.max(60, distance / 1.25),
      geometry: { coordinates },
      legs: [{
        steps: [{
          name: 'nearest street vector',
          distance,
          duration: Math.max(60, distance / 1.25),
          maneuver: { instruction: `Follow nearest street vector for segment ${index + 1}` }
        }]
      }]
    }
  };
}

async function fetchSegment(start: Coordinate, end: Coordinate, token: string | null, index: number): Promise<SegmentResult> {
  if (!token) return vectorFallbackSegment(start, end, index);

  const coordinatePath = `${start.lng.toFixed(6)},${start.lat.toFixed(6)};${end.lng.toFixed(6)},${end.lat.toFixed(6)}`;
  const query = new URLSearchParams({
    access_token: token,
    alternatives: 'false',
    geometries: 'geojson',
    overview: 'full',
    steps: 'true',
    language: 'en',
    continue_straight: 'false',
    radiuses: '80;80',
    approaches: 'unrestricted;unrestricted'
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEGMENT_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://api.mapbox.com/directions/v5/${WALKING_PROFILE}/${coordinatePath}?${query.toString()}`,
      { cache: 'no-store', signal: controller.signal, headers: { Accept: 'application/json' } }
    );
    const raw = await response.text();
    const data = raw ? JSON.parse(raw) as MapboxResponse : null;

    if (!response.ok || data?.code !== 'Ok' || !data.routes?.length) {
      return vectorFallbackSegment(start, end, index);
    }

    return { index, route: data.routes[0], source: 'mapbox' };
  } catch {
    return vectorFallbackSegment(start, end, index);
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const token = getMapboxToken();
  const payload = await request.json().catch(() => null) as { coordinates?: unknown } | null;
  const submitted = Array.isArray(payload?.coordinates)
    ? payload.coordinates.filter(validCoordinate)
    : [];

  if (submitted.length < 2 || submitted.length > MAX_COORDINATES) {
    return noStoreJson({ error: `Provide between 2 and ${MAX_COORDINATES} valid coordinates.` }, 400);
  }

  const coordinates = loopCoordinates(submitted);
  const segmentResults = (await Promise.all(
    coordinates.slice(0, -1).map((point, index) => fetchSegment(point, coordinates[index + 1], token, index))
  )).sort((a, b) => a.index - b.index);

  const geometry: Coordinate[] = [];
  const steps: Array<{ instruction: string; street: string | null; distanceFeet: number; durationSeconds: number }> = [];
  let distanceMeters = 0;
  let durationSeconds = 0;
  let fallbackSegments = 0;

  for (const segmentResult of segmentResults) {
    const segment = segmentResult.route;
    const segmentGeometry = segment.geometry?.coordinates ?? [];
    if (segmentResult.source === 'vector-fallback') fallbackSegments += 1;
    if (segmentGeometry.length < 2) continue;

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

  if (geometry.length < 2) {
    const fallback = coordinates.slice(0, -1).map((point, index) => vectorFallbackSegment(point, coordinates[index + 1], index));
    for (const segmentResult of fallback) {
      const mappedGeometry = segmentResult.route.geometry.coordinates.map(([lng, lat]) => ({ lng, lat }));
      geometry.push(...(geometry.length ? mappedGeometry.slice(1) : mappedGeometry));
      distanceMeters += segmentResult.route.distance;
      durationSeconds += segmentResult.route.duration;
    }
    fallbackSegments = fallback.length;
  }

  return noStoreJson({
    geometry,
    steps: steps.length ? steps : [{ instruction: 'Approximate street-vector loop generated from route handles', street: 'nearest street vector', distanceFeet: Math.round(distanceMeters * 3.28084), durationSeconds: Math.round(durationSeconds) }],
    distanceMiles: Number((distanceMeters / METERS_PER_MILE).toFixed(2)),
    durationMinutes: Math.max(1, Math.round(durationSeconds / 60)),
    waypointCount: Math.max(0, coordinates.length - 2),
    segmentCount: segmentResults.length,
    fallbackSegments,
    approximate: fallbackSegments > 0,
    looped: true,
    elapsedMs: Date.now() - startedAt
  });
}
