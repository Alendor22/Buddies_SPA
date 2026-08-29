import { NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const candidateSchema = z.object({
  dogId: z.string().min(1),
  slug: z.string().min(1),
  confidence: z.number().min(0).max(1),
});
const providerResponseSchema = z.object({
  candidates: z.array(candidateSchema).max(20).default([]),
  requestId: z.string().optional(),
});

export async function POST(request: Request) {
  const endpoint = process.env.DOG_RECOGNITION_ENDPOINT;
  if (!endpoint) {
    return NextResponse.json({ error: 'Doggy Recognition provider is not configured.' }, { status: 503 });
  }

  const form = await request.formData().catch(() => null);
  const image = form?.get('image');
  if (!(image instanceof File) || !image.type.startsWith('image/')) {
    return NextResponse.json({ error: 'A dog image is required.' }, { status: 400 });
  }
  if (image.size === 0 || image.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'Image must be between 1 byte and 8 MB.' }, { status: 413 });
  }

  const upstream = new FormData();
  upstream.append('image', image, image.name || 'dog-image.jpg');
  const headers = new Headers();
  const apiKey = process.env.DOG_RECOGNITION_API_KEY;
  if (apiKey) headers.set('authorization', `Bearer ${apiKey}`);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: upstream,
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      return NextResponse.json({ error: 'Recognition provider is unavailable.' }, { status: 502 });
    }
    const parsed = providerResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Recognition provider returned an invalid result.' }, { status: 502 });
    }
    return NextResponse.json(parsed.data, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Recognition provider timed out or could not be reached.' }, { status: 502 });
  }
}
