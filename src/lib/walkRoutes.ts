import { Prisma } from '@prisma/client';

export type ParsedRoutePlan = {
  name: string | null;
  routeEngine: string | null;
  plan: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  routeGeometry: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  routeSteps: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  routeDistanceMiles: number | null;
  routeDurationMin: number | null;
};

export function parseRoutePlan(raw: string): ParsedRoutePlan {
  const empty: ParsedRoutePlan = {
    name: null,
    routeEngine: null,
    plan: Prisma.JsonNull,
    routeGeometry: Prisma.JsonNull,
    routeSteps: Prisma.JsonNull,
    routeDistanceMiles: null,
    routeDurationMin: null
  };

  if (!raw || raw.length > 300_000) return empty;

  try {
    const value = JSON.parse(raw) as {
      name?: unknown;
      routeEngine?: unknown;
      route?: unknown;
      routeSteps?: unknown;
      distanceMiles?: unknown;
      durationMinutes?: unknown;
      [key: string]: unknown;
    };

    const route = Array.isArray(value.route)
      ? value.route.filter((point): point is { lat: number; lng: number } => {
          if (!point || typeof point !== 'object') return false;
          const candidate = point as { lat?: unknown; lng?: unknown };
          return typeof candidate.lat === 'number'
            && Number.isFinite(candidate.lat)
            && candidate.lat >= -90
            && candidate.lat <= 90
            && typeof candidate.lng === 'number'
            && Number.isFinite(candidate.lng)
            && candidate.lng >= -180
            && candidate.lng <= 180;
        }).slice(0, 5000)
      : [];

    const steps = Array.isArray(value.routeSteps)
      ? value.routeSteps.filter((step): step is string => typeof step === 'string').slice(0, 200)
      : [];

    const name = typeof value.name === 'string' ? value.name.slice(0, 120) : null;
    const routeEngine = typeof value.routeEngine === 'string' ? value.routeEngine.slice(0, 80) : null;
    const routeDistanceMiles = typeof value.distanceMiles === 'number' && Number.isFinite(value.distanceMiles)
      ? Math.max(0, value.distanceMiles)
      : null;
    const routeDurationMin = typeof value.durationMinutes === 'number' && Number.isFinite(value.durationMinutes)
      ? Math.max(0, Math.round(value.durationMinutes))
      : null;

    const plan = {
      ...value,
      name,
      routeEngine,
      route,
      routeSteps: steps,
      distanceMiles: routeDistanceMiles,
      durationMinutes: routeDurationMin
    } as Prisma.InputJsonValue;

    return {
      name,
      routeEngine,
      plan,
      routeGeometry: route.length ? route as Prisma.InputJsonValue : Prisma.JsonNull,
      routeSteps: steps.length ? steps as Prisma.InputJsonValue : Prisma.JsonNull,
      routeDistanceMiles,
      routeDurationMin
    };
  } catch {
    return empty;
  }
}
