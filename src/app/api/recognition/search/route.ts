import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { RecognitionEventOutcome } from '@/generated/prisma/client';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isDogRecognitionEnrollmentEnabled } from '@/lib/recognition/featureFlag';
import { cosineSimilarity, DOG_REID_MODEL_VERSION, embedVerificationImage } from '@/lib/recognition/embeddings';
import { rateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const SEARCH_LIMIT = 20;
const SEARCH_WINDOW_SECONDS = 600;

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
    const vector = await embedVerificationImage(new Uint8Array(await image.arrayBuffer()), image.type);
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
    await prisma.recognitionEvent.create({
      data: {
        requestId,
        source: 'lost-dog-search',
        matchedDogId: best?.dog.id ?? null,
        confidence: best?.score ?? null,
        outcome: best ? RecognitionEventOutcome.MATCH : RecognitionEventOutcome.NO_MATCH,
        modelVersion: DOG_REID_MODEL_VERSION,
        candidateCount: candidates.length,
        latencyMs: Date.now() - startedAt,
        metadata: {
          comparison: 'mean-top-3-of-8-view-embeddings',
          requiresOwnerConfirmation: true,
          reporterUserId: user.id
        }
      }
    });

    if (candidates.length > 0) {
      await prisma.notification.createMany({
        data: candidates.map((candidate) => ({
          userId: candidate.ownerId,
          type: 'SYSTEM' as const,
          routeKey: `lost-dog-recognition:${requestId}:${candidate.dog.id}`,
          href: `/dogs/${encodeURIComponent(candidate.dog.slug)}`,
          title: 'Possible lost-dog match',
          body: `A found-dog photo may match ${candidate.dog.name}. Review the photo and confirm the identity.`,
          dogId: candidate.dog.id
        }))
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
        score: candidate.score,
        ownerNotified: true
      }))
    });
  } catch {
    return NextResponse.json({ error: 'Lost-dog search is temporarily unavailable.' }, { status: 503 });
  }
}
