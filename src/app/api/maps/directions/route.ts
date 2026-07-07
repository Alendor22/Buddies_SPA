import { NextRequest, NextResponse } from 'next/server';
import { getMapboxToken } from '@/lib/mapboxToken';

export const dynamic = 'force-dynamic';

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

export async function POST(request: NextRequest) {
  const token = getMapboxToken();
  if (!token) {
    return NextResponse.json({ error: 'Mapbox access token is not configured.' }, { status: 503 });
  }

  const payload = await request.json().catch(() => null) as { coordinates?: unknown } | null;
  const coordinates = Array.isArray(payload?.coordinates) ? payload.coordinates.filter(validCoordinate) : [];
  if (coordinates.length < 2 || coordinates.length > 25) {
    return NextResponse.json({ error: 'Provide between 2 and 25 valid coordinates.' }, { status: 400 });
  }

  const coordinatePath = coordinates.map((point) => `${point.lng},${point.lat}`).join(';');
  const query = new URLSearchParams({
    access_token: token,
    alternatives: 'false',
    geometries: 'geojson',
    overview: 'full',
    steps: 'true',
    language: 'en',
    voice_units: 'imperial',
    walkway_bias: '0.5'
  });

  const response = await fetch(
    `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinatePath}?${query.toString()}`,
    { cache: 'no-store' }
  );
  const data = await response.json().catch(() => null) as { code?: string; message?: string; routes?: MapboxRoute[] } | null;

  if (!response.ok || data?.code !== 'Ok' || !data.routes?.length) {
    return NextResponse.json(
      { error: data?.message || 'A walkable street route could not be generated.' },
      { status: response.ok ? 422 : response.status }
    );
  }

  const route = data.routes[0];
  const steps = route.legs.flatMap((leg) => leg.steps).map((step) => ({
    instruction: step.maneuver?.instruction || (step.name ? `Continue on ${step.name}` : 'Continue on the route'),
    street: step.name || null,
    distanceFeet: Math.round((step.distance || 0) * 3.28084),
    durationSeconds: Math.round(step.duration || 0)
  }));

  return NextResponse.json({
    geometry: route.geometry.coordinates.map(([lng, lat]) => ({ lng, lat })),
    steps,
    distanceMiles: Number((route.distance / 1609.344).toFixed(2)),
    durationMinutes: Math.max(1, Math.round(route.duration / 60))
  });
}
