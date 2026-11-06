import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export class MetaError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new MetaError(503, 'Meta integration is not configured.');
  return value;
}
export function enabled(flag = 'CORE') { return process.env[`META_${flag}_ENABLED`] === 'true'; }
export function assertEnabled(flag = 'CORE') {
  if (!enabled() || !enabled(flag)) throw new MetaError(404, 'Meta feature unavailable.');
}
export function origin() {
  const url = new URL(required('META_APP_ORIGIN'));
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new MetaError(503, 'Invalid Meta origin.');
  return url.origin;
}
export function hash(value: string | Buffer) { return createHash('sha256').update(value).digest('hex'); }
export function opaque() { return randomBytes(32).toString('base64url'); }
function key() {
  const value = Buffer.from(required('META_TOKEN_KEY'), 'base64');
  if (value.length !== 32) throw new MetaError(503, 'Meta encryption key must be 32 bytes.');
  return value;
}
// AES-GCM binds ciphertext to its owning account and asset. No token enters a browser response.
export function encrypt(value: string, context: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(context));
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}
export function decrypt(value: string, context: string) {
  const [version, iv, tag, ciphertext, extra] = value.split('.');
  if (version !== 'v1' || !iv || !tag || !ciphertext || extra) throw new MetaError(503, 'Invalid encrypted token.');
  const cipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  cipher.setAAD(Buffer.from(context));
  cipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([cipher.update(Buffer.from(ciphertext, 'base64url')), cipher.final()]).toString('utf8');
}
export function signatureValid(body: Buffer, signature: string | null) {
  if (!signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createHmac('sha256', required('META_APP_SECRET')).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'));
}
export async function boundedBody(request: Request, max = 65536) {
  if (Number(request.headers.get('content-length')) > max) throw new MetaError(413, 'Request too large.');
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  if (reader) {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > max) throw new MetaError(413, 'Request too large.');
        chunks.push(value);
      }
    } finally { await reader.cancel(); }
  }
  return Buffer.concat(chunks);
}

export function signedRequestUser(value: string) {
  const [signature, payload, extra] = value.split('.');
  if (!signature || !payload || extra || !/^[A-Za-z0-9_-]+$/.test(signature) || !/^[A-Za-z0-9_-]+$/.test(payload)) throw new MetaError(403, 'Invalid signed request.');
  const expected = createHmac('sha256', required('META_APP_SECRET')).update(payload).digest();
  const supplied = Buffer.from(signature, 'base64url');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new MetaError(403, 'Invalid signed request.');
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (data.algorithm !== 'HMAC-SHA256' || !/^\d{1,40}$/.test(data.user_id) || typeof data.issued_at !== 'number' || data.issued_at * 1000 > Date.now() + 60000 || data.issued_at * 1000 < Date.now() - 86400000) throw new MetaError(403, 'Invalid signed request.');
  return data.user_id as string;
}
