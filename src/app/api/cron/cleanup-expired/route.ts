import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Presence and map-report rows carry an expiresAt but nothing ever deleted them, so both
// tables grew without bound. Vercel Cron hits this on a schedule (see vercel.json) to purge
// rows once they've aged out of the live map.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
  }

  const now = new Date();
  const [presences, reports] = await Promise.all([
    prisma.dogPresence.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.mapReport.deleteMany({ where: { expiresAt: { lt: now } } })
  ]);

  return NextResponse.json(
    {
      ok: true,
      deleted: { presences: presences.count, reports: reports.count },
      checkedAt: now.toISOString()
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
