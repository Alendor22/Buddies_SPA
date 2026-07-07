import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { parseRoutePlan } from '@/lib/walkRoutes';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const favorites = await prisma.favoriteRoute.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      name: true,
      plan: true,
      routeDistanceMiles: true,
      routeDurationMin: true,
      createdAt: true
    }
  });

  return NextResponse.json({
    favorites: favorites.map((favorite) => ({
      id: favorite.id,
      name: favorite.name,
      routeJson: JSON.stringify(favorite.plan),
      distanceMiles: favorite.routeDistanceMiles,
      durationMinutes: favorite.routeDurationMin,
      createdAt: favorite.createdAt.toISOString()
    }))
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const body = await request.json().catch(() => null) as { routeJson?: unknown; dogId?: unknown } | null;
  const routeJson = typeof body?.routeJson === 'string' ? body.routeJson : '';
  const dogId = typeof body?.dogId === 'string' && body.dogId.trim() ? body.dogId.trim() : null;
  const routePlan = parseRoutePlan(routeJson);

  if (!Array.isArray(routePlan.routeGeometry) || !routePlan.routeGeometry.length || !routePlan.plan || Array.isArray(routePlan.plan)) {
    return NextResponse.json({ error: 'Generate a valid street route before saving.' }, { status: 400 });
  }

  if (dogId) {
    const dog = await prisma.dog.findFirst({ where: { id: dogId, ownerId: user.id }, select: { id: true } });
    if (!dog) return NextResponse.json({ error: 'Dog profile not found.' }, { status: 404 });
  }

  const favorite = await prisma.favoriteRoute.create({
    data: {
      ownerId: user.id,
      dogId,
      name: routePlan.name || 'Favorite walk route',
      routeEngine: routePlan.routeEngine,
      plan: routePlan.plan,
      routeGeometry: routePlan.routeGeometry,
      routeSteps: routePlan.routeSteps,
      routeDistanceMiles: routePlan.routeDistanceMiles,
      routeDurationMin: routePlan.routeDurationMin
    }
  });

  return NextResponse.json({
    favorite: {
      id: favorite.id,
      name: favorite.name,
      routeJson: JSON.stringify(favorite.plan),
      distanceMiles: favorite.routeDistanceMiles,
      durationMinutes: favorite.routeDurationMin,
      createdAt: favorite.createdAt.toISOString()
    }
  }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const body = await request.json().catch(() => null) as { id?: unknown } | null;
  const id = typeof body?.id === 'string' ? body.id.trim() : '';
  if (!id) return NextResponse.json({ error: 'Favorite route id is required.' }, { status: 400 });

  const result = await prisma.favoriteRoute.deleteMany({ where: { id, ownerId: user.id } });
  if (!result.count) return NextResponse.json({ error: 'Favorite route not found.' }, { status: 404 });

  return NextResponse.json({ deleted: true });
}
