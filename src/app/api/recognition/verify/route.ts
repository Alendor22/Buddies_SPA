import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { RecognitionEventOutcome } from '@/generated/prisma/client';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isDogRecognitionEnrollmentEnabled } from '@/lib/recognition/featureFlag';
import { cosineSimilarity, DOG_REID_MODEL_VERSION, embedVerificationImage } from '@/lib/recognition/embeddings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

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

export async function POST(request: NextRequest) {
  if (!isDogRecognitionEnrollmentEnabled()) return NextResponse.json({ error: 'Dog recognition enrollment is disabled.' }, { status: 404 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in to verify a dog identity.' }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const dogId = form?.get('dogId');
  const image = form?.get('image');
  if (typeof dogId !== 'string' || !(image instanceof File)) return NextResponse.json({ error: 'dogId and image are required.' }, { status: 400 });
  if (!ALLOWED.has(image.type) || image.size < 1 || image.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Use a JPEG, PNG, or WebP image up to 8 MB.' }, { status: 400 });
  }

  const dog = await prisma.dog.findUnique({
    where: { id: dogId },
    select: {
      id: true,
      slug: true,
      recognitionEnrollment: {
        select: {
          id: true,
          status: true,
          modelVersion: true,
          assets: {
            where: { status: 'READY', modelVersion: DOG_REID_MODEL_VERSION },
            orderBy: { updatedAt: 'desc' },
            select: { captureView: true, embeddingRef: true }
          }
        }
      }
    }
  });
  const enrollment = dog?.recognitionEnrollment;
  if (!dog || !enrollment || enrollment.status !== 'ACTIVE' || enrollment.modelVersion !== DOG_REID_MODEL_VERSION) {
    return NextResponse.json({ error: 'This dog does not have an active visual identity enrollment.' }, { status: 404 });
  }

  const embeddings = new Map<string, number[]>();
  for (const asset of enrollment.assets) {
    if (!asset.captureView || embeddings.has(asset.captureView)) continue;
    const vector = parseEmbedding(asset.embeddingRef);
    if (vector) embeddings.set(asset.captureView, vector);
  }
  if (embeddings.size !== 8) return NextResponse.json({ error: 'The eight-angle enrollment is incomplete.' }, { status: 409 });

  const threshold = Number(process.env.DOG_REID_MATCH_THRESHOLD);
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold >= 1) {
    return NextResponse.json({ error: 'Dog identity matching has not been calibrated.' }, { status: 503 });
  }

  try {
    const vector = await embedVerificationImage(new Uint8Array(await image.arrayBuffer()), image.type);
    const scores = [...embeddings.values()].map((reference) => cosineSimilarity(vector, reference)).sort((a, b) => b - a);
    const score = scores.slice(0, 3).reduce((sum, current) => sum + current, 0) / Math.min(3, scores.length);
    const matched = score >= threshold;
    await prisma.recognitionEvent.create({
      data: {
        requestId: randomUUID(),
        source: 'qr-dog-verification',
        matchedDogId: matched ? dog.id : null,
        confidence: score,
        outcome: matched ? RecognitionEventOutcome.MATCH : RecognitionEventOutcome.NO_MATCH,
        modelVersion: DOG_REID_MODEL_VERSION,
        candidateCount: 1,
        metadata: { comparison: 'mean-top-3-of-8-view-embeddings' }
      }
    });
    return NextResponse.json({ matched, score, modelVersion: DOG_REID_MODEL_VERSION });
  } catch {
    return NextResponse.json({ error: 'Dog identity verification is temporarily unavailable.' }, { status: 503 });
  }
}
