import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { r2 } from '@/lib/r2';

// Previously unauthenticated: anyone could mint R2 upload URLs against this bucket,
// with no limit on type or count.
const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic'
]);

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const schema = z.object({
  filename: z.string().min(1).max(200),
  contentType: z.string().min(1)
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const contentType = parsed.data.contentType.toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return NextResponse.json({ error: 'Unsupported file type.' }, { status: 415 });
  }

  // Namespacing by user id keeps one account's uploads from colliding with another's
  // and makes ownership auditable from the key alone.
  const safeName = parsed.data.filename.replace(/[^a-zA-Z0-9._-]/g, '-');
  const key = `uploads/${user.id}/${crypto.randomUUID()}-${safeName}`;

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    ContentLength: MAX_UPLOAD_BYTES
  });

  const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 600 });
  const publicUrl = process.env.R2_PUBLIC_URL ? `${process.env.R2_PUBLIC_URL}/${key}` : null;
  return NextResponse.json({ uploadUrl, key, publicUrl });
}
