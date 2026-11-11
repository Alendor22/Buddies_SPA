import { PutObjectCommand } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { RecognitionEventOutcome } from '@/generated/prisma/client';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { r2 } from '@/lib/r2';
import { isDogRecognitionEnrollmentEnabled } from '@/lib/recognition/featureFlag';
import { cosineSimilarity, DOG_REID_MODEL_VERSION, embedVerificationImage } from '@/lib/recognition/embeddings';
import { rateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Match the recognition provider's cold-start allowance and the enrollment processor.
export const maxDuration = 180;

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const SEARCH_LIMIT = 20;
const SEARCH_WINDOW_SECONDS = 600;
const PHOTO_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

function matchPageUrl(requestId: string, dogId: string) {
  return `/dashboard/lost-dog-matches/${encodeURIComponent(requestId)}/${encodeURIComponent(dogId)}`;
}

function parseEmbedding(value: string | null): number[] | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length !== 512 ||
        parsed.some((part) => typeof part !== 'number' || !Number.isFinite(part))) return null;
    return parsed as number[];
  } catch {
    return null;
  }
}

function scoreAgainstEnrollment(vector: number[], assets: Array<{ captureView: string | null; embeddingRef: string | null }>) {
  const references = new Map<string, number[]>();
  for (const asset of assets) {
    if (!asset.captureView || references.has(asset.captureView)) continue;
    const embedding = parseEmbedding(asset.embeddingRef);
    if (embedding) references.set(asset.captureView, embedding);
  }
  if (references.size !== 8) return null;
  const scores = [...references.values()]
    .map((reference) => cosineSimilarity(vector, reference))
    .sort((left, right) => right - left);
  return scores.slice(0, 3).reduce((sum, value) => sum + value, 0) / 3;
}

export async function POST(request: NextRequest) {
  if (!isDogRecognitionEnrollmentEnabled()) {
    return NextResponse.json({ error: 'Dog recognition is disabled.' }, { status: 404 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in to report a found dog.' }, { status: 401 });

  const limit = await rateLimit('recognition:search', user.id, SEARCH_LIMIT, SEARCH_WINDOW_SECONDS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many searches. Try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  const form = await request.formData().catch(() => null);
  const image = form?.get('image');
  if (!(image instanceof File)) {
    return NextResponse.json({ error: 'A found-dog image is required.' }, { status: 400 });
  }
  if (!ALLOWED.has(image.type) || image.size < 1 || image.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Use a JPEG, PNG, or WebP image up to 8 MB.' }, { status: 400 });
  }

  const threshold = Number(process.env.DOG_REID_MATCH_THRESHOLD);
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold >= 1) {
    return NextResponse.json({ error: 'Dog identity matching has not been calibrated.' }, { status: 503 });
  }

  try {
    const startedAt = Date.now();
    const bytes = new Uint8Array(await image.arrayBuffer());
    const vector = await embedVerificationImage(bytes, image.type);
    const enrollments = await prisma.recognitionEnrollment.findMany({
      where: {
        status: 'ACTIVE',
        modelVersion: DOG_REID_MODEL_VERSION,
        dog: { status: 'LOST' }
      },
      select: {
        ownerId: true,
        dog: {
          select: { id: true, name: true, slug: true, publicId: true }
        },
        assets: {
          where: { status: 'READY', modelVersion: DOG_REID_MODEL_VERSION },
          orderBy: { updatedAt: 'desc' },
          select: { captureView: true, embeddingRef: true }
        }
      }
    });

    const candidates = enrollments
      .map((enrollment) => {
        const score = scoreAgainstEnrollment(vector, enrollment.assets);
        if (score === null) return null;
        return { ...enrollment, score };
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
      .filter((candidate) => candidate.score >= threshold)
      .sort((left, right) => right.score - left.score)
      .slice(0, 5);

    const requestId = randomUUID();
    const best = candidates[0];

    // Only retain a photo when there's someone to show it to. The storage key is
    // deterministic from requestId, so it can be written to the event at creation time
    // — before the upload is even attempted — rather than attached afterward. That way
    // the cleanup cron always has a pointer to find and expire, with no window where a
    // successful upload could exist with nothing in the DB tracking it.
    const bucket = process.env.R2_BUCKET_NAME;
    const willStorePhoto = candidates.length > 0 && Boolean(bucket);
    const extension = EXTENSION_BY_MIME[image.type] ?? 'jpg';
    const photoStorageKey = willStorePhoto ? `recognition/lost-dog-search/${requestId}.${extension}` : null;
    const photoExpiresAt = willStorePhoto ? new Date(Date.now() + PHOTO_RETENTION_MS) : null;

    const event = await prisma.recognitionEvent.create({
      data: {
        requestId,
        source: 'lost-dog-search',
        matchedDogId: best?.dog.id ?? null,
        confidence: best?.score ?? null,
        outcome: best ? RecognitionEventOutcome.MATCH : RecognitionEventOutcome.NO_MATCH,
        modelVersion: DOG_REID_MODEL_VERSION,
        candidateCount: candidates.length,
        latencyMs: Date.now() - startedAt,
        reporterUserId: user.id,
        photoStorageKey,
        photoExpiresAt,
        metadata: { comparison: 'mean-top-3-of-8-view-embeddings' }
      }
    });

    if (willStorePhoto && bucket && photoStorageKey) {
      try {
        await r2.send(new PutObjectCommand({
          Bucket: bucket,
          Key: photoStorageKey,
          Body: bytes,
          ContentType: image.type,
          Metadata: { purpose: 'lost-dog-search', requestId, reporterUserId: user.id }
        }));
      } catch {
        // The pointer already recorded above would otherwise claim a photo exists that
        // was never written. Clear it — a best-effort downgrade, not a safety-critical
        // one: if this update itself fails, the cron's delete attempt on a key that was
        // never created is a harmless no-op, not a leak.
        await prisma.recognitionEvent.update({
          where: { id: event.id },
          data: { photoStorageKey: null, photoExpiresAt: null }
        }).catch(() => undefined);
      }
    }

    if (candidates.length > 0) {
      await prisma.recognitionEventCandidate.createMany({
        data: candidates.map((candidate) => ({
          recognitionEventId: event.id,
          dogId: candidate.dog.id,
          score: candidate.score
        }))
      });

      await prisma.notification.createMany({
        data: [
          ...candidates.map((candidate) => ({
            userId: candidate.ownerId,
            type: 'SYSTEM' as const,
            routeKey: `lost-dog-recognition:${requestId}:${candidate.dog.id}`,
            href: matchPageUrl(requestId, candidate.dog.id),
            title: 'Possible lost-dog match',
            body: `A found-dog photo may match ${candidate.dog.name}. View the photo and message the finder.`,
            dogId: candidate.dog.id
          })),
          ...candidates.map((candidate) => ({
            userId: user.id,
            type: 'SYSTEM' as const,
            routeKey: `lost-dog-recognition-report:${requestId}:${candidate.dog.id}`,
            href: matchPageUrl(requestId, candidate.dog.id),
            title: 'Your found-dog report was sent',
            body: `${candidate.dog.name}'s owner was notified. Open this to message them.`,
            dogId: candidate.dog.id
          }))
        ]
      });
    }

    return NextResponse.json({
      requestId,
      requiresOwnerConfirmation: true,
      matches: candidates.map((candidate) => ({
        dogId: candidate.dog.id,
        publicId: candidate.dog.publicId,
        name: candidate.dog.name,
        profileUrl: `/dogs/${encodeURIComponent(candidate.dog.slug)}`,
        qrUrl: `/dogs/${encodeURIComponent(candidate.dog.slug)}/qr`,
        matchUrl: matchPageUrl(requestId, candidate.dog.id),
        score: candidate.score,
        ownerNotified: true
      }))
    });
  } catch (error) {
    console.error('[recognition/search] failed', error);
    return NextResponse.json({ error: 'Lost-dog search is temporarily unavailable.' }, { status: 503 });
  }
}
