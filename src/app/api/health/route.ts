import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPublicMapboxToken } from '@/lib/mapboxToken';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const CHECK_TIMEOUT_MS = 3000;
const CACHE_TTL_MS = 10_000;

type CheckStatus = 'healthy' | 'configured' | 'not_configured' | 'unhealthy' | 'skipped';

type HealthPayload = {
  status: 'ok' | 'degraded' | 'unavailable';
  ready: boolean;
  timestamp: string;
  uptimeSeconds: number;
  deployment: {
    environment: string;
    commitSha: string;
    branch: string;
    region: string;
  };
  checks: {
    database: { status: CheckStatus; latencyMs?: number; error?: string };
    auth: { status: CheckStatus };
    mapbox: { status: CheckStatus };
    redis: { status: CheckStatus; latencyMs?: number; error?: string };
    ably: { status: CheckStatus };
    r2: { status: CheckStatus };
  };
};

let cachedDeepHealth: { expiresAt: number; payload: HealthPayload } | null = null;

function configured(...values: Array<string | undefined>) {
  return values.every((value) => Boolean(value?.trim()));
}

async function withTimeout<T>(task: Promise<T>, timeoutMs: number) {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      task,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs} ms`)), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function databaseCheck() {
  const startedAt = Date.now();
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, CHECK_TIMEOUT_MS);
    return { status: 'healthy' as const, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return {
      status: 'unhealthy' as const,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message.slice(0, 160) : 'Database check failed'
    };
  }
}

async function redisCheck() {
  if (!redis) return { status: 'not_configured' as const };

  const startedAt = Date.now();
  try {
    await withTimeout(redis.ping(), CHECK_TIMEOUT_MS);
    return { status: 'healthy' as const, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return {
      status: 'unhealthy' as const,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message.slice(0, 160) : 'Redis check failed'
    };
  }
}

function deploymentMetadata() {
  return {
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'local',
    branch: process.env.VERCEL_GIT_COMMIT_REF || process.env.GITHUB_REF_NAME || 'local',
    region: process.env.VERCEL_REGION || process.env.AWS_REGION || 'unknown'
  };
}

async function buildHealthPayload(deep: boolean): Promise<HealthPayload> {
  const authConfigured = configured(process.env.AUTH_SECRET);
  const mapboxConfigured = Boolean(getPublicMapboxToken());
  const ablyConfigured = configured(process.env.ABLY_API_KEY, process.env.NEXT_PUBLIC_ABLY_KEY);
  const r2Configured = configured(
    process.env.R2_ACCOUNT_ID,
    process.env.R2_ACCESS_KEY_ID,
    process.env.R2_SECRET_ACCESS_KEY,
    process.env.R2_BUCKET_NAME
  );

  const [database, redisStatus] = deep
    ? await Promise.all([databaseCheck(), redisCheck()])
    : [
        { status: 'skipped' as const },
        redis ? { status: 'configured' as const } : { status: 'not_configured' as const }
      ];

  const ready = authConfigured && (!deep || database.status === 'healthy');
  const optionalUnhealthy = deep && redisStatus.status === 'unhealthy';
  const status = ready ? (optionalUnhealthy ? 'degraded' : 'ok') : 'unavailable';

  return {
    status,
    ready,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    deployment: deploymentMetadata(),
    checks: {
      database,
      auth: { status: authConfigured ? 'configured' : 'not_configured' },
      mapbox: { status: mapboxConfigured ? 'configured' : 'not_configured' },
      redis: redisStatus,
      ably: { status: ablyConfigured ? 'configured' : 'not_configured' },
      r2: { status: r2Configured ? 'configured' : 'not_configured' }
    }
  };
}

export async function GET(request: NextRequest) {
  const deep = request.nextUrl.searchParams.get('deep') === '1';
  let payload: HealthPayload;

  if (deep && cachedDeepHealth && cachedDeepHealth.expiresAt > Date.now()) {
    payload = cachedDeepHealth.payload;
  } else {
    payload = await buildHealthPayload(deep);
    if (deep) cachedDeepHealth = { payload, expiresAt: Date.now() + CACHE_TTL_MS };
  }

  return NextResponse.json(payload, {
    status: payload.ready ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'CDN-Cache-Control': 'no-store',
      'Vercel-CDN-Cache-Control': 'no-store',
      'X-Buddies-Commit': payload.deployment.commitSha
    }
  });
}
