import { GetObjectCommand } from '@aws-sdk/client-s3';
import { r2 } from '@/lib/r2';

export const DOG_REID_MODEL_VERSION = 'open-noodle/pet-recognition-base@main';
// The provider lazily loads the detector and embedding model on its first image
// request. Keep a bounded timeout, but allow that cold start to complete.
const PROVIDER_TIMEOUT_MS = 55_000;

function config() {
  const endpoint = process.env.DOG_REID_ENDPOINT_URL?.trim();
  const token = process.env.DOG_REID_ENDPOINT_TOKEN?.trim();
  const bucket = process.env.R2_BUCKET_NAME?.trim();
  if (!endpoint || !token || !bucket) throw new Error('Dog re-identification provider is not configured');
  return { endpoint: endpoint.replace(/\/$/, ''), token, bucket };
}

async function callEmbedding(bytes: Uint8Array, mimeType: string) {
  const { endpoint, token } = config();
  const form = new FormData();
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  form.set('image', new Blob([body], { type: mimeType }), 'dog-image');
  const response = await fetch(`${endpoint}/embed`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    cache: 'no-store',
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error('Dog re-identification provider failed');
  const payload = await response.json() as { embedding?: unknown; modelVersion?: unknown };
  if (!Array.isArray(payload.embedding) || payload.embedding.length !== 512 ||
      payload.embedding.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    throw new Error('Dog re-identification provider returned an invalid embedding');
  }
  return payload.embedding as number[];
}

export async function embedEnrollmentImage(storageKey: string, mimeType: string) {
  const { bucket } = config();
  const object = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: storageKey }));
  if (!object.Body) throw new Error('Enrollment image was not found');
  const bytes = await object.Body.transformToByteArray();
  return { embedding: await callEmbedding(bytes, mimeType), modelVersion: DOG_REID_MODEL_VERSION };
}

export function embedVerificationImage(bytes: Uint8Array, mimeType: string) {
  return callEmbedding(bytes, mimeType);
}

export function cosineSimilarity(left: number[], right: number[]) {
  if (left.length !== 512 || right.length !== 512) throw new Error('Invalid dog embedding dimensions');
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let i = 0; i < 512; i += 1) {
    dot += left[i] * right[i];
    leftNorm += left[i] ** 2;
    rightNorm += right[i] ** 2;
  }
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : 0;
}
