import { createHmac, timingSafeEqual } from 'node:crypto';

export type MetaPlatform = 'facebook' | 'instagram' | 'whatsapp';
export const META_GRAPH_VERSION = 'v24.0';
const GRAPH_BASE = 'https://graph.facebook.com';

export function verifyMetaWebhookSignature(body: Buffer, signature: string | null, appSecret: string): boolean {
  if (!signature?.startsWith('sha256=') || !appSecret) return false;
  const actual = Buffer.from(signature.slice(7), 'hex');
  const expected = createHmac('sha256', appSecret).update(body).digest();
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function verifyMetaWebhookChallenge(
  mode: string | null, token: string | null, challenge: string | null, expectedToken: string
): string | null {
  return mode === 'subscribe' && token && expectedToken && token === expectedToken && challenge
    ? challenge : null;
}

export function buildMetaShareUrl(platform: 'facebook' | 'whatsapp', target: string, caption?: string): string {
  const url = new URL(target);
  if (url.protocol !== 'https:') throw new Error('Sharing requires HTTPS');
  if (platform === 'facebook') {
    const share = new URL('https://www.facebook.com/sharer/sharer.php');
    share.searchParams.set('u', url.toString());
    return share.toString();
  }
  const share = new URL('https://wa.me/');
  share.searchParams.set('text', [caption, url.toString()].filter(Boolean).join(' '));
  return share.toString();
}

export async function metaGraphRequest<T>(
  path: string, accessToken: string, options: { method?: 'GET' | 'POST'; params?: Record<string, string> } = {}
): Promise<T> {
  if (!/^\/?[a-zA-Z0-9_./-]+$/.test(path) || path.includes('..')) throw new Error('Invalid Graph API path');
  if (!accessToken) throw new Error('Missing Meta access token');
  const url = new URL(`${GRAPH_BASE}/${META_GRAPH_VERSION}/${path.replace(/^\//, '')}`);
  for (const [key, value] of Object.entries(options.params ?? {})) url.searchParams.set(key, value);
  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error(`Meta Graph API returned HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

export async function sendWhatsAppTemplate(
  phoneNumberId: string, recipient: string, templateName: string, languageCode: string, token: string
) {
  if (!/^\d+$/.test(phoneNumberId) || !/^\+?\d{7,15}$/.test(recipient)) throw new Error('Invalid WhatsApp destination');
  if (!/^[a-z0-9_]+$/.test(templateName)) throw new Error('Invalid template name');
  if (!/^[a-z]{2}(?:_[A-Z]{2})?$/.test(languageCode)) throw new Error('Invalid language');
  const url = `${GRAPH_BASE}/${META_GRAPH_VERSION}/${phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', to: recipient, type: 'template',
      template: { name: templateName, language: { code: languageCode } }
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error(`WhatsApp API returned HTTP ${response.status}`);
  return response.json();
}
