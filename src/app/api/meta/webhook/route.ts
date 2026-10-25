import { assertEnabled, boundedBody, MetaError, required, signatureValid } from '@/lib/meta/security';
import { processWebhook } from '@/lib/meta/webhook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    assertEnabled('MESSAGING');
    const url = new URL(request.url);
    const challenge = url.searchParams.get('hub.challenge');
    if (url.searchParams.get('hub.mode') !== 'subscribe' || url.searchParams.get('hub.verify_token') !== required('META_WEBHOOK_VERIFY_TOKEN') || !challenge || !/^\d{1,100}$/.test(challenge)) return new Response('Forbidden', { status: 403 });
    return new Response(challenge, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return new Response('Unavailable', { status: 503 }); }
}
export async function POST(request: Request) {
  try {
    assertEnabled('MESSAGING');
    const body = await boundedBody(request);
    if (!signatureValid(body, request.headers.get('x-hub-signature-256'))) return new Response('Forbidden', { status: 403 });
    // Acknowledge only after the database transaction commits. Payload bodies are
    // deliberately not retained; only the dedup hash and reply-window metadata.
    await processWebhook(body);
    return new Response('EVENT_RECEIVED');
  } catch (error) {
    const status = error instanceof MetaError ? error.status : error instanceof SyntaxError ? 400 : 503;
    return new Response('Webhook not processed', { status });
  }
}
