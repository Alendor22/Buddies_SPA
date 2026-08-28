import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
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
  // This reports the database host, name and row counts, which is reconnaissance
  // material. Diagnostics stay available, but only to signed-in users.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const identity = getDatabaseIdentity();

  try {
    const [dogCount, userCount, walkCount, messageCount] = await Promise.all([
      prisma.dog.count(),
      prisma.user.count(),
      prisma.walk.count(),
      prisma.message.count()
    ]);

    return NextResponse.json(
      {
        ok: true,
        database: identity,
        counts: {
          dogs: dogCount,
          users: userCount,
          walks: walkCount,
          messages: messageCount
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
        error: 'Database query failed.',
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
