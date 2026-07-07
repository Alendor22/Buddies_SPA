import { Prisma } from '@prisma/client';

export type ParsedRoutePlan = {
  name: string | null;
  routeEngine: string | null;
  routeGeometry: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  routeSteps: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  routeDistanceMiles: number | null;
  routeDurationMin: number | null;
};

export function parseRoutePlan(raw: string): ParsedRoutePlan {
  const empty: ParsedRoutePlan = {
    name: null,
    routeEngine: null,
    routeGeometry: Prisma.JsonNull,
    routeSteps: Prisma.JsonNull,
    routeDistanceMiles: null,
    routeDurationMin: null
  };

  if (!raw) return empty;

  try {
    const value = JSON.parse(raw) as {
      name?: unknown;
      routeEngine?: unknown;
      route?: unknown;
      routeSteps?: unknown;
      distanceMiles?: unknown;
      durationMinutes?: unknown;
    };

    const route = Array.isArray(value.route)
      ? value.route.filter((point): point is { lat: number; lng: number } => {
          if (!point || typeof point !== 'object') return false;
          const candidate = point as { lat?: unknown; lng?: unknown };
          return typeof candidate.lat === 'number' && Number.isFinite(candidate.lat) && typeof candidate.lng === 'number' && Number.isFinite(candidate.lng);
        }).slice(0, 5000)
      : [];

    const steps = Array.isArray(value.routeSteps)
      ? value.routeSteps.filter((step): step is string => typeof step === 'string').slice(0, 200)
      : [];

    return {
      name: typeof value.name === 'string' ? value.name.slice(0, 120) : null,
      routeEngine: typeof value.routeEngine === 'string' ? value.routeEngine.slice(0, 80) : null,
      routeGeometry: route.length ? route as Prisma.InputJsonValue : Prisma.JsonNull,
      routeSteps: steps.length ? steps as Prisma.InputJsonValue : Prisma.JsonNull,
      routeDistanceMiles: typeof value.distanceMiles === 'number' && Number.isFinite(value.distanceMiles) ? value.distanceMiles : null,
      routeDurationMin: typeof value.durationMinutes === 'number' && Number.isFinite(value.durationMinutes) ? Math.round(value.durationMinutes) : null
    };
  } catch {
    return empty;
  }
}
