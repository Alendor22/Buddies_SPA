import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { r2 } from '@/lib/r2';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Presence and map-report rows carry an expiresAt but nothing ever deleted them, so both
// tables grew without bound. Vercel Cron hits this on a schedule (see vercel.json) to purge
// rows once they've aged out of the live map.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Cron secret is not configured.' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const now = new Date();
  const [presences, reports, expiredPhotos] = await Promise.all([
    prisma.dogPresence.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.mapReport.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.recognitionEvent.findMany({
      where: { photoExpiresAt: { lt: now }, photoStorageKey: { not: null } },
      select: { id: true, photoStorageKey: true }
    })
  ]);

  // Lost-dog search photos are retained only long enough for a matched owner to review
  // them. Only clear the DB pointer once R2 confirms the object is gone — if the delete
  // fails, leave it in place so this same event is picked up and retried on the next run
  // instead of becoming an orphan nothing will ever find again.
  let deletedPhotos = 0;
  const bucket = process.env.R2_BUCKET_NAME;
  if (bucket && expiredPhotos.length > 0) {
    await Promise.all(expiredPhotos.map(async (event) => {
      try {
        await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: event.photoStorageKey! }));
      } catch {
        return;
      }
      await prisma.recognitionEvent.update({
        where: { id: event.id },
        data: { photoStorageKey: null, photoExpiresAt: null }
      });
      deletedPhotos += 1;
    }));
  }

  return NextResponse.json(
    {
      ok: true,
      deleted: { presences: presences.count, reports: reports.count, lostDogSearchPhotos: deletedPhotos },
      checkedAt: now.toISOString()
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
