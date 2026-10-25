import { NextRequest, NextResponse } from 'next/server';
import { verifyMetaWebhookChallenge, verifyMetaWebhookSignature } from '@/lib/meta/integrations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const challenge = verifyMetaWebhookChallenge(
    searchParams.get('hub.mode'), searchParams.get('hub.verify_token'),
    searchParams.get('hub.challenge'), process.env.META_WEBHOOK_VERIFY_TOKEN ?? ''
  );
  return challenge === null
    ? new NextResponse('Forbidden', { status: 403 })
    : new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
}

export async function POST(request: NextRequest) {
  const appSecret = process.env.META_APP_SECRET ?? '';
  if (!appSecret) return NextResponse.json({ error: 'Integration unavailable' }, { status: 503 });
  const raw = Buffer.from(await request.arrayBuffer());
  if (raw.length > 1024 * 1024) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  if (!verifyMetaWebhookSignature(raw, request.headers.get('x-hub-signature-256'), appSecret))
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  // Do not acknowledge business events as processed before a durable, idempotent event queue exists.
  // Meta retries non-2xx responses; keep disabled until the consumer is implemented.
  return NextResponse.json({ error: 'Webhook consumer not configured' }, { status: 503 });
}
