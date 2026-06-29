import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getDatabaseIdentity() {
  const raw = process.env.DATABASE_URL;

  if (!raw) {
    return {
      configured: false,
      host: null,
      database: null,
      pooled: null
    };
  }

  try {
    const url = new URL(raw);
    return {
      configured: true,
      host: url.hostname,
      database: url.pathname.replace(/^\//, '') || null,
      pooled: url.hostname.includes('-pooler')
    };
  } catch {
    return {
      configured: true,
      host: 'invalid-url',
      database: null,
      pooled: null
    };
  }
}

export async function GET() {
  const identity = getDatabaseIdentity();

  try {
    const [dogCount, userCount, migrationCount] = await Promise.all([
      prisma.dog.count(),
      prisma.user.count(),
      prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM "_prisma_migrations"`
    ]);

    return NextResponse.json(
      {
        ok: true,
        database: identity,
        counts: {
          dogs: dogCount,
          users: userCount,
          migrations: Number(migrationCount[0]?.count ?? 0)
        },
        checkedAt: new Date().toISOString()
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0'
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        database: identity,
        error: error instanceof Error ? error.message : 'Unknown database error',
        checkedAt: new Date().toISOString()
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, max-age=0'
        }
      }
    );
  }
}
