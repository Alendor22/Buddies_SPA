import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { r2 } from '@/lib/r2';

const schema = z.object({ filename: z.string().min(1), contentType: z.string().min(1) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const key = `uploads/${crypto.randomUUID()}-${parsed.data.filename.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
  const command = new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key, ContentType: parsed.data.contentType });
  const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 600 });
  const publicUrl = process.env.R2_PUBLIC_URL ? `${process.env.R2_PUBLIC_URL}/${key}` : null;
  return NextResponse.json({ uploadUrl, key, publicUrl });
}
